import os,json
from playwright.sync_api import sync_playwright,expect
BASE=os.environ.get('VALLAEYJAR_URL','http://localhost:8778')
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--use-angle=metal']);errors=[]
 for mobile in [False,True]:
  ctx=browser.new_context(viewport={'width':390,'height':844} if mobile else {'width':1440,'height':1000},has_touch=mobile,is_mobile=mobile)
  page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto(BASE+'/projects/vallaeyjar/viewer.html');page.wait_for_function('window.stadiumViewer?.islands.length===2',timeout=90000)
  card=page.locator('.island-card').filter(has=page.get_by_role('heading',name='Víkingsvöllur',exact=True));expect(card).to_be_visible();assert card.locator('.remove-card').count()==0
  card.locator('.enter').click();page.wait_for_function('stadiumViewer.metadata.name==="Víkingsvöllur"');page.wait_for_timeout(1400)
  page.locator('#choose-seat').click();page.wait_for_timeout(200)
  point=page.evaluate('''() => {
   for(const mesh of stadiumViewer.groups.main_stand.children){const index=mesh.userData.seats?.findIndex(s=>s.id==='D-05-11');if(index===undefined||index<0)continue;
    mesh.updateWorldMatrix(true,false);const m=mesh.matrixWorld.clone().fromArray(mesh.instanceMatrix.array,index*16);const p=stadiumViewer.camera.position.clone().set(0,.41,-.06).applyMatrix4(m).applyMatrix4(mesh.matrixWorld).project(stadiumViewer.camera);const r=document.querySelector('#viewport').getBoundingClientRect();return {x:r.x+(p.x+1)*r.width/2,y:r.y+(1-p.y)*r.height/2};}
  }''')
  if mobile:page.touchscreen.tap(point['x'],point['y'])
  else:page.mouse.click(point['x'],point['y'])
  page.wait_for_function('stadiumViewer.mode==="seat"');assert page.evaluate('stadiumViewer.selectedSeat.id')=='D-05-11';assert page.evaluate('stadiumViewer.groups.roof.visible')
  eye=page.evaluate('stadiumViewer.camera.position.toArray()');page.keyboard.press('ArrowRight');assert page.evaluate('stadiumViewer.camera.position.toArray()')==eye
  page.screenshot(path='/tmp/vikingur-island-seat-mobile.png' if mobile else '/tmp/vikingur-island-seat.png')
  page.locator('#leave-seat').click();page.evaluate('stadiumViewer.showWorld(false)');page.locator('.island-card').filter(has=page.get_by_role('heading',name='Kaplakriki',exact=True)).locator('.enter').click();assert page.evaluate('stadiumViewer.metadata.seat_count_model')==3050
  page.reload();page.wait_for_function('window.stadiumViewer?.islands.length===2',timeout=90000);page.screenshot(path='/tmp/vikingur-islands-mobile.png' if mobile else '/tmp/vikingur-islands.png')
  card.locator('.enter').click();page.wait_for_function('stadiumViewer.metadata.name==="Víkingsvöllur"')
  if not mobile:
   with page.expect_download() as dl:page.locator('#export-island').click()
   pkg=json.load(open(dl.value.path()));assert sum(len(b.get('seats',[])) for b in pkg['stadium']['model']['batches'])==1076
   page.evaluate('stadiumViewer.showWorld(false)');page.locator('#add-island').click();page.locator('#stadium-file').set_input_files({'name':'Vikingur.stadium','mimeType':'application/json','buffer':json.dumps(pkg).encode()});expect(page.locator('#confirm-import')).to_be_enabled();page.locator('#confirm-import').click();expect(page.locator('#import-dialog')).not_to_be_visible();assert len(page.evaluate('stadiumViewer.islands'))==2
  print('PASS Vikingur', 'mobile' if mobile else 'desktop','two persistent islands, raycast seat, fixed eye, roof restore, Kaplakriki switch',flush=True);ctx.close()
 assert not errors,errors
 browser.close()
