export const DOSES=[5,10,20];
export const DURATIONS=[{days:7,label:'1 vika'},{days:14,label:'2 vikur'},{days:30,label:'Mánuður'},{days:90,label:'3 mánuðir'},{days:180,label:'Hálft ár'},{days:365,label:'Ár'}];
// Display interpolation only. No fitted pharmacokinetics or personalized prediction.
export function scenario(dose,days){
 if(!DOSES.includes(dose)||!Number.isFinite(days)||days<0||days>365)throw new RangeError('Unsupported scenario');
 const storage=Math.min(1,days/(dose===20?7:dose===10?18:28));
 const growth=days<14?0:Math.min(1,(days-14)/76);
 const phase=days<14?'Upphleðsla':days<30?'Birgðir byggjast upp':days<90?'Þjálfunaraðlögun':'Viðhald og áframhaldandi þjálfun';
 const caution=dose===5?'5 g á dag er algengur viðhaldsskammtur fyrir heilbrigða fullorðna. Upphleðsla er ekki nauðsynleg.':dose===10?'10 g á dag: meiri skammtur tryggir ekki meiri árangur þegar vöðvabirgðir eru mettaðar. Nákvæmur tími að mettun er óviss.':days<=7?'20 g á dag líkist hefðbundinni upphleðslu í 5–7 daga, oft skipt í 4 × 5 g. Eftir það eru 3–5 g á dag algengt viðhald.':'20 g á dag allan valinn tíma er há samfelld inntaka, ekki hefðbundið viðhald. Ekki er sýnt að hún skili meiri langtímaávinningi; meltingaróþægindi geta aukist.';
 const timeNote=days<=7?'Fyrsta vikan: birgðir og vatnsinnihald geta breyst. Sýnilegur munur er ekki sönnun um nýjan vöðvavef.':days<=14?'Eftir tvær vikur: birgðir geta enn verið að byggjast upp, sérstaklega án upphleðslu. Þjálfunaraðlögun er rétt að hefjast.':days<=30?'Um einn mánuð: regluleg inntaka getur fært vöðvabirgðir nálægt jafnvægi. Það er ekki loforð um ákveðna þyngdar- eða styrktaraukningu.':days<=90?'Eftir þrjá mánuði: viðbótarávinningur kreatíns getur birst samhliða reglulegri styrktarþjálfun. Umfang er mjög einstaklingsbundið.':'Eftir sex til tólf mánuði: áframhaldandi inntaka getur viðhaldið birgðum. Vöxtur heldur ekki áfram í föstu hlutfalli við skammt eða fjölda daga.';
 return {timeNote,dose,days,storage,growth,phase,caution,highDose:dose>5,cognitiveGain:null,predictedKg:null,storageLabel:storage<.45?'Á uppleið':storage<1?'Að fyllast':'Nálægt jafnvægi',longTerm:days>=180};
}
