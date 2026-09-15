/* Pacifer - replicile personajelor. Fisier de date, se editeaza cu mana.
 *
 * Fiecare cheie este `id`-ul unui personaj din data/world.js.
 * Valoarea e o functie care primeste starea jocului (g.stats, g.flags)
 * si intoarce o lista de replici:
 *
 *   { who:'Cine vorbeste', text:'...', set:{ flag:true } }
 *   { who, text, choices:[ { text, effect:{trezorerie:-200}, set:{...}, reply:'...' } ] }
 *
 * `effect` modifica indicatorii (trezorerie, stabilitate, hrana),
 * `set` ridica steaguri de poveste pe care alte dialoguri le pot citi.
 */
window.PACIFER_DIALOGS = {

  villager: g => g.flags.stieDeFoamete
    ? [{ who: 'Săteanul', text: 'Ai vorbit cu împăratul, părinte? Oamenii întreabă de tine în fiecare seară.' }]
    : [
      { who: 'Săteanul', text: 'Părinte, hambarul e pe jumătate gol. Grindina ne-a culcat orzul înainte de seceriș.' },
      { who: 'Săteanul', text: 'Dacă mai vin perceptorii, plecăm cu toții peste râu, în ținutul de miazănoapte.' },
      { who: 'Călugărul', text: 'Voi vorbi cu împăratul. Nimeni nu va fi lăsat să flămânzească.', set: { stieDeFoamete: true } },
    ],

  guard_gate: g => g.flags.stieDeFoamete
    ? [{ who: 'Gardianul', text: 'Măria Sa te așteaptă în sala tronului, părinte. Intră.' }]
    : [
      { who: 'Gardianul', text: 'Poarta e deschisă pentru tine, părinte, dar Măria Sa nu primește pe nimeni cu mâna goală.' },
      { who: 'Gardianul', text: 'Dacă vii cu o veste din vale, vino cu ea întreagă. Vorbește întâi cu oamenii.' },
    ],

  guard_hall: () => [
    { who: 'Garda palatului', text: 'Stau aici de la răsărit. Sfetnicii intră mulți, ies puțini cu vreo hotărâre.' },
  ],

  negustor: g => g.flags.graneCumparate
    ? [{ who: 'Negustorul', text: 'Grâul e pe drum spre hambarul satului, părinte. M-ai lăsat sărac și fericit.' }]
    : [
      { who: 'Negustorul', text: 'Am trei care de grâu în șură. Prețul e prețul: trei sute de galbeni, nici un ban mai puțin.' },
      { who: 'Călugărul', text: 'Trei sute pentru grâu care s-ar strica până la primăvară?',
        choices: [
          { text: 'Plătim cele trei sute', effect: { trezorerie: -300, hrana: +25, stabilitate: +5 },
            set: { graneCumparate: true },
            reply: 'S-a făcut. Carele pleacă mâine în zori — ai cuvântul meu.' },
          { text: 'Îți dau două sute, acum', effect: { trezorerie: -200, hrana: +15 },
            set: { graneCumparate: true },
            reply: 'Ești aspru pentru un călugăr. Fie, două sute — dar numai două care.' },
          { text: 'Mai vorbim când scade prețul', reply: 'Vorbim, cum să nu. Numai că foamea nu așteaptă tocmeala.' },
        ] },
    ],

  batranul: () => [
    { who: 'Bătrânul', text: 'Podul de peste râu l-am ridicat cu tatăl meu, acum patruzeci de ani. Grinzile de la mijloc putrezesc.' },
    { who: 'Bătrânul', text: 'Spune-i împăratului: dacă se rupe podul, valea rămâne singură iarna asta.' },
  ],

  emperor: g => {
    const intro = g.flags.stieDeFoamete
      ? { who: 'Împăratul', text: 'Ai fost în vale, frate. Spune drept: e răzvrătire sau e foame?' }
      : { who: 'Împăratul', text: 'Frate, ce vești aduci? Perceptorii spun că țăranii din Valea de Jos nu vor să plătească darea.' };
    if (g.flags.dareHotarata) {
      return [{ who: 'Împăratul', text: 'Hotărârea e luată și dusă la vale. Lasă-mă acum, frate — vin soli de la hotar.' }];
    }
    return [
      intro,
      { who: 'Călugărul', text: 'Măria Ta, recolta le-a fost distrusă de grindină. Nu e răzvrătire, e foame. Ce hotărâm?',
        choices: [
          { text: 'Iertăm darea pe un an', effect: { trezorerie: -200, stabilitate: +10 },
            set: { dareHotarata: true },
            reply: 'Fie. Pierdem 200 de galbeni, dar câștigăm loialitatea văii.' },
          { text: 'Cerem doar jumătate din dare', effect: { trezorerie: -100, stabilitate: +3 },
            set: { dareHotarata: true },
            reply: 'O cale de mijloc. Vezi ca boierii să nu ia diferența de la săraci.' },
          { text: 'Darea se plătește întreagă', effect: { stabilitate: -12, hrana: -5 },
            set: { dareHotarata: true },
            reply: 'Legea e lege. Dar dacă valea se golește, va fi vina noastră.' },
        ] },
    ];
  },
};
