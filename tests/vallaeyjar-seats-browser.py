"""Actual seat raycasts, fixed-eye controls and mobile taps against the viewer."""
import os
from playwright.sync_api import sync_playwright, expect

BASE = os.environ.get('VALLAEYJAR_URL', 'http://localhost:3014')
ERRORS = []


def choose(page, name, row=5, mobile=False):
    page.locator('#choose-seat').click()
    assert not page.evaluate('stadiumViewer.groups.roof.visible')
    # Project an actual seat pan into screen space, then click through the UI's raycaster.
    point = page.evaluate('''({name,row}) => {
      const mesh=Object.values(stadiumViewer.groups).flatMap(g=>g.children).find(m=>m.name.startsWith(name));
      const candidates=mesh.userData.seats.map((s,i)=>({s,i})).filter(({s})=>s.row===row);
      const {s,i}=candidates[Math.floor(candidates.length/2)];
      mesh.updateWorldMatrix(true,false);
      const instance=mesh.matrixWorld.clone().fromArray(mesh.instanceMatrix.array,i*16);
      const p=stadiumViewer.camera.position.clone().set(0,.45,-.06).applyMatrix4(instance).applyMatrix4(mesh.matrixWorld).project(stadiumViewer.camera);
      const rect=document.querySelector('#viewport').getBoundingClientRect();
      return {x:rect.x+(p.x+1)*rect.width/2,y:rect.y+(1-p.y)*rect.height/2,label:s.label};
    }''', {'name': name, 'row': row})
    if mobile:
        page.touchscreen.tap(point['x'], point['y'])
    else:
        page.mouse.click(point['x'], point['y'])
    page.wait_for_function('stadiumViewer.mode === "seat"')
    expect(page.locator('#seat-label')).to_have_text(point['label'])
    assert page.evaluate('stadiumViewer.groups.roof.visible'), 'Picker must restore roof for the seated view'
    assert page.evaluate('stadiumViewer.camera.near') == .08
    assert page.evaluate('stadiumViewer.camera.fov') == 65
    expect(page.locator('#mobile-view')).to_have_value('seat')
    assert page.evaluate('stadiumViewer.camera.position.distanceTo(stadiumViewer.camera.position.clone().fromArray(stadiumViewer.selectedSeat.position))') < .0001
    return point


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, args=['--use-angle=metal'])
    for mobile in [False, True]:
        context = browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1440,'height':1000}, has_touch=mobile, is_mobile=mobile)
        page = context.new_page()
        page.set_default_timeout(30000)
        page.on('pageerror', lambda e: ERRORS.append(str(e)))
        page.on('console', lambda m: ERRORS.append(m.text) if m.type=='error' else None)
        page.goto(BASE+'/projects/vallaeyjar/viewer.html', timeout=120000)
        expect(page.locator('#loader')).to_be_hidden(timeout=60000)
        page.locator('.enter').first.click()
        expect(page.locator('#choose-seat')).to_be_visible()
        choose(page, 'South seat', 5, mobile)
        before=page.evaluate('stadiumViewer.camera.position.toArray()')
        rotation=page.evaluate('stadiumViewer.camera.quaternion.toArray()')
        page.keyboard.press('ArrowLeft')
        assert page.evaluate('stadiumViewer.camera.quaternion.toArray()') != rotation
        page.keyboard.down('w')
        page.wait_for_timeout(200)
        page.keyboard.up('w')
        assert page.evaluate('stadiumViewer.camera.position.toArray()') == before
        box=page.locator('#viewport').bounding_box()
        x,y=box['x']+box['width']*.6, box['y']+box['height']*.4
        rotation=page.evaluate('stadiumViewer.camera.quaternion.toArray()')
        if mobile:
            session=context.new_cdp_session(page)
            session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
            session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x+50,'y':y+20}]})
            session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
        else:
            page.mouse.move(x,y);page.mouse.down();page.mouse.move(x+50,y+20,steps=8);page.mouse.up()
        assert page.evaluate('stadiumViewer.camera.quaternion.toArray()') != rotation
        assert page.evaluate('stadiumViewer.camera.position.toArray()') == before
        page.screenshot(path='/tmp/vallaeyjar-seat-mobile.png' if mobile else '/tmp/vallaeyjar-seat-south.png')
        page.locator('#leave-seat').click()
        assert page.evaluate('stadiumViewer.mode')=='orbit'
        assert page.evaluate('stadiumViewer.selectedSeat') is None
        choose(page, 'North seat', 8, mobile)
        page.screenshot(path='/tmp/vallaeyjar-seat-north-mobile.png' if mobile else '/tmp/vallaeyjar-seat-north.png')
        page.keyboard.press('Escape')
        assert page.evaluate('stadiumViewer.mode')=='orbit'
        expect(page.locator('#seat-status')).to_be_hidden()
        if not mobile:
            for name, row in [('South seat R04', 5), ('North end short row', 2)]:
                choose(page, name, row)
                page.locator('#leave-seat').click()
        # Leaving the picker without sitting also restores the roof.
        page.locator('#choose-seat').click()
        page.evaluate('stadiumViewer.setView("overview")')
        assert page.evaluate('stadiumViewer.groups.roof.visible')
        # A click on the pitch does not turn into a seat selection.
        page.locator('#choose-seat').click()
        point=page.evaluate('''()=>{const m=stadiumViewer.groups.pitch.children[0];const p=stadiumViewer.camera.position.clone().set(0,.2,0).applyMatrix4(m.matrixWorld).project(stadiumViewer.camera);const r=document.querySelector('#viewport').getBoundingClientRect();return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2}}''')
        page.mouse.click(point['x'],point['y'])
        assert page.evaluate('stadiumViewer.mode')=='orbit'
        page.evaluate('stadiumViewer.showWorld(false)')
        expect(page.locator('#seat-tools')).to_be_hidden()
        assert page.evaluate('stadiumViewer.groups.roof.visible')
        print('PASS', 'mobile tap/drag' if mobile else 'desktop click/drag', 'both stands, fixed eyes, arrows, Escape, return button, roof restoration, non-seat click',flush=True)
        context.close()
    browser.close()
assert not ERRORS, ERRORS
