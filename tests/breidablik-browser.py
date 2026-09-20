from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import json,os
URL=os.environ.get('VALLAEYJAR_URL','http://127.0.0.1:8780')+'/projects/vallaeyjar/viewer.html'
R=Path(__file__).resolve().parents[2]/'Breidablik_Blender';errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 page=browser.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(URL,timeout=120000);page.wait_for_function('!!window.stadiumViewer',timeout=120000)
 card=page.locator('.island-card').filter(has_text='Kópavogsvöllur');expect(card.locator('.number')).to_have_text('EYJA G');assert card.locator('.remove-card').count()==0
 card.locator('.enter').click();page.wait_for_function('stadiumViewer.metadata.island_label==="G"');page.wait_for_timeout(1500)
 assert page.evaluate('stadiumViewer.metadata.seat_count_model')==1733
 page.screenshot(path=str(R/'renders/island-g-overview.png'))
 for sid in ['A-05-11','G-06-09']:
  page.locator('#choose-seat').click();page.wait_for_timeout(500)
  point=page.evaluate('''sid=>{
   const mesh=Object.values(stadiumViewer.groups).flatMap(g=>g.children).find(m=>m.userData.seats?.some(s=>s.id===sid));
   const i=mesh.userData.seats.findIndex(s=>s.id===sid);mesh.updateWorldMatrix(true,false);
   const instance=mesh.matrixWorld.clone().fromArray(mesh.instanceMatrix.array,i*16);
   const p=stadiumViewer.camera.position.clone().set(0,.44,-.05).applyMatrix4(instance).applyMatrix4(mesh.matrixWorld).project(stadiumViewer.camera);
   const r=document.querySelector('#viewport').getBoundingClientRect();return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};
  }''',sid)
  page.mouse.click(point['x'],point['y']);page.wait_for_function('stadiumViewer.mode==="seat"');assert page.evaluate('stadiumViewer.selectedSeat.id')==sid
  before=page.evaluate('stadiumViewer.camera.position.toArray()');rotation=page.evaluate('stadiumViewer.camera.quaternion.toArray()');page.keyboard.press('ArrowLeft');assert page.evaluate('stadiumViewer.camera.position.toArray()')==before;assert page.evaluate('stadiumViewer.camera.quaternion.toArray()')!=rotation
  assert page.evaluate('stadiumViewer.groups.roof.visible');page.screenshot(path=str(R/f'renders/island-g-{sid}.png'));page.locator('#leave-seat').click()
 page.goto(URL+'?island=breidablik');page.wait_for_function('window.stadiumViewer?.metadata.island_label==="G"',timeout=120000)
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(1000);page.screenshot(path=str(R/'renders/island-g-mobile.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 json.dump({'public_card':'EYJA G','west_click':'A-05-11','east_click':'G-06-09','fixed_eye_rotation':True,'deep_link':True,'mobile_width':390,'errors':errors},open(R/'island-verification.json','w'),indent=2)
 browser.close()
print('PASS island G card, both stand raycasts, fixed-eye rotation, roof restoration, direct link, mobile')
