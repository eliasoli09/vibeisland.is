"""Verify the shipped island and true raycast seat selection, desktop and mobile."""
import os,json
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('VALLAEYJAR_URL','http://127.0.0.1:8876')
errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 for mobile in [False,True]:
  context=browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1440,'height':1000},has_touch=mobile,is_mobile=mobile)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE+'/projects/vallaeyjar/viewer.html',timeout=120000)
  page.wait_for_function('!!window.stadiumViewer',timeout=120000)
  names=page.evaluate('stadiumViewer.islands.map(i=>i.name)')
  assert 'Hlíðarendi · Valur' in names and 'Kaplakriki' in names and 'Víkingsvöllur' in names,names
  card=page.locator('.island-card').filter(has=page.get_by_role('heading',name='Hlíðarendi · Valur',exact=True))
  assert card.locator('.remove-card').count()==0
  card.locator('.enter').click();page.locator('#choose-seat').click()
  point=page.evaluate('''()=>{
   const m=Object.values(stadiumViewer.groups).flatMap(g=>g.children).find(m=>m.userData.seats?.some(s=>s.id==='C-07-13'));
   const i=m.userData.seats.findIndex(s=>s.id==='C-07-13');m.updateWorldMatrix(true,false);
   const im=m.matrixWorld.clone().fromArray(m.instanceMatrix.array,i*16);
   const p=stadiumViewer.camera.position.clone().set(0,.40,-.08).applyMatrix4(im).applyMatrix4(m.matrixWorld).project(stadiumViewer.camera);
   const r=document.querySelector('#viewport').getBoundingClientRect();return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2,label:m.userData.seats[i].label};
  }''')
  (page.touchscreen.tap if mobile else page.mouse.click)(point['x'],point['y'])
  page.wait_for_function('stadiumViewer.mode==="seat"')
  expect(page.locator('#seat-label')).to_have_text(point['label'])
  assert page.evaluate('stadiumViewer.groups.roof.visible')
  pos=page.evaluate('stadiumViewer.camera.position.toArray()');rotation=page.evaluate('stadiumViewer.camera.quaternion.toArray()')
  page.keyboard.press('ArrowRight');assert page.evaluate('stadiumViewer.camera.position.toArray()')==pos;assert page.evaluate('stadiumViewer.camera.quaternion.toArray()')!=rotation
  page.screenshot(path='/tmp/valur-island-mobile.png' if mobile else '/tmp/valur-island-seat.png')
  page.locator('#leave-seat').click();assert page.evaluate('stadiumViewer.mode')=='orbit'
  page.locator('#home-button').click();expect(card).to_be_visible()
  if not mobile:
   page.screenshot(path='/tmp/valur-islands.png')
   with page.expect_download() as download:
    card.locator('.enter').click();page.locator('#export-island').click()
   saved=Path('/tmp/valur-export.stadium');download.value.save_as(saved)
   pkg=json.loads(saved.read_text());assert pkg['stadium']['model']['metadata']['seat_count_model']==1200
   page.goto(BASE+'/projects/vallaeyjar/viewer.html?island=valur',timeout=120000)
   page.wait_for_function('window.stadiumViewer?.metadata.name==="Hlíðarendi · Valur"',timeout=120000)
   expect(page.locator('#home-button')).to_be_visible()
  print('PASS', 'mobile' if mobile else 'desktop', 'built-in island, click C-07-13, fixed eye rotation, roof, return',flush=True)
  context.close()
 browser.close()
assert not errors,errors
