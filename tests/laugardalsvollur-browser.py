from playwright.sync_api import sync_playwright,expect
from pathlib import Path
import json,os
URL=os.environ.get('VALLAEYJAR_URL','http://127.0.0.1:8784')+'/projects/vallaeyjar/viewer.html'
R=Path(os.environ.get('VALLAEYJAR_ARTIFACTS','/tmp/laugardalsvollur-browser'));(R/'renders').mkdir(parents=True,exist_ok=True);errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal'])
 page=browser.new_page(viewport={'width':1440,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda m:errors.append(m.text) if m.type=='error' else None)
 page.goto(URL,timeout=120000);page.wait_for_function('!!window.stadiumViewer',timeout=120000)
 card=page.locator('.island-card').filter(has_text='Laugardalsvöllur');assert card.locator('.remove-card').count()==0
 card.locator('.enter').click();page.wait_for_function('stadiumViewer.metadata.name==="Laugardalsvöllur"');page.wait_for_timeout(1500)
 assert page.evaluate('stadiumViewer.metadata.seat_count_model')==9636
 assert page.locator('#model-sources').get_attribute('href')=='./laugardalsvollur-sources.html'
 assert 'áætluð' in page.locator('#assumptions').text_content()
 page.screenshot(path=str(R/'renders/laugardalsvollur-overview.png'))
 for sid in ['W-E-12-20','E-O-07-13']:
  page.locator('#choose-seat').click();page.wait_for_timeout(500)
  point=page.evaluate('''sid=>{
   const mesh=Object.values(stadiumViewer.groups).flatMap(g=>g.children).find(m=>m.userData.seats?.some(s=>s.id===sid));
   const i=mesh.userData.seats.findIndex(s=>s.id===sid);mesh.updateWorldMatrix(true,false);
   const instance=mesh.matrixWorld.clone().fromArray(mesh.instanceMatrix.array,i*16);
   const p=stadiumViewer.camera.position.clone().set(0,.46,.08).applyMatrix4(instance).applyMatrix4(mesh.matrixWorld).project(stadiumViewer.camera);
   const r=document.querySelector('#viewport').getBoundingClientRect();return{x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};
  }''',sid)
  page.mouse.click(point['x'],point['y']);page.wait_for_function('stadiumViewer.mode==="seat"');assert page.evaluate('stadiumViewer.selectedSeat.id')==sid
  before=page.evaluate('stadiumViewer.camera.position.toArray()');rotation=page.evaluate('stadiumViewer.camera.quaternion.toArray()');page.keyboard.press('ArrowLeft');assert page.evaluate('stadiumViewer.camera.position.toArray()')==before;assert page.evaluate('stadiumViewer.camera.quaternion.toArray()')!=rotation
  assert page.evaluate('stadiumViewer.groups.roof.visible');page.screenshot(path=str(R/f'renders/laugardalsvollur-{sid}.png'));page.locator('#leave-seat').click()
 page.evaluate('stadiumViewer.showWorld()')
 for name in ['Kaplakriki','Víkingsvöllur','Hlíðarendi','Kópavogsvöllur']:
  other=page.locator('.island-card').filter(has_text=name);assert other.count()==1;other.locator('.enter').click();page.wait_for_function('stadiumViewer.mode!=="world"');page.evaluate('stadiumViewer.showWorld()')
 page.goto(URL+'?island=laugardalsvollur');page.wait_for_function('window.stadiumViewer?.metadata.name==="Laugardalsvöllur"',timeout=120000)
 page.set_viewport_size({'width':390,'height':844});page.wait_for_timeout(1000);page.screenshot(path=str(R/'renders/laugardalsvollur-mobile.png'));assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 json.dump({'public_card':'Laugardalsvöllur','west_click':'W-E-12-20','east_click':'E-O-07-13','fixed_eye_rotation':True,'deep_link':True,'mobile_width':390,'errors':errors},open(R/'island-verification.json','w'),indent=2)
 browser.close()
print('PASS Laugardalsvollur card, both stand raycasts, fixed-eye rotation, roof restoration, direct link, mobile')
