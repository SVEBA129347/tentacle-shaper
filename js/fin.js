/* Tentacle Shaper — страница «Плавник-насос»: как работает плавник Tentaclesurf с каналом Вентури,
 * анимация потока и расчёт прижима присоски по скорости (TS.hydro.pump). Ссылка: …/#fin. GPL v3. */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var DIM = { d1: 11, d2: 6, d3: 11, eta: 0.85, k: 0.3, depth: 70, pad: 80, seal: 0.8 };
  var kmh = 18, raf = null, t0 = 0, parts = [], reduce = false;

  // разрез: доска едет влево, вода бежит вправо; канал в плавнике, трубка к присоске на деке
  // сцена в разрезе: серфер на доске, плавник у хвоста, трубка внутри доски к присоске под передней ногой;
  // слева внизу — плавник крупно, с каналом Вентури. Доска едет влево, вода бежит вправо.
  var SVG = '' +
  '<svg id="finSvg" viewBox="0 0 1000 600" role="img" aria-labelledby="finSvgT">' +
  '<title id="finSvgT"></title>' +
  '<defs>' +
    '<linearGradient id="fSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfaf3"/><stop offset="1" stop-color="#eef0e8"/></linearGradient>' +
    '<linearGradient id="fW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc0cd"/><stop offset="1" stop-color="#2f7d8f"/></linearGradient>' +
    '<linearGradient id="fBoard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff35a"/><stop offset="1" stop-color="#e2d400"/></linearGradient>' +
    '<linearGradient id="fFin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#575757"/><stop offset="1" stop-color="#101010"/></linearGradient>' +
    '<path id="fFinShape" d="M0 0C.16 .32 .5 .8 1.06 .98C1.16 1.01 1.2 .95 1.13 .9C.98 .78 .86 .55 .86 .32C.86 .14 .9 .04 .98 0Z"/>' +
    '<linearGradient id="fFace" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f7d8f"/><stop offset=".7" stop-color="#3f98a3"/><stop offset="1" stop-color="#8fd3c8"/></linearGradient>' +
    '<linearGradient id="fRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7a0"/><stop offset=".45" stop-color="#f2e400"/><stop offset="1" stop-color="#c9bd00"/></linearGradient>' +
    '<marker id="fA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#c2255c"/></marker>' +
    '<clipPath id="fWater"><rect x="0" y="438" width="1000" height="162"/></clipPath>' +
  '</defs>' +
  '<rect width="1000" height="600" fill="url(#fSky)"/>' +
  // вода и волна от катера (вейк): гладкий склон справа, пена по гребню
  '<path d="M0 434 C 300 432, 700 436, 830 432 C 880 428, 920 404, 944 370 C 962 344, 980 324, 1000 314 L 1000 600 L 0 600 Z" fill="url(#fFace)"/>' +
  '<path d="M0 452 C 300 450, 640 456, 1000 440 L 1000 600 L 0 600 Z" fill="#2a7385" opacity=".55"/>' +
  '<path d="M944 370 C 962 344, 980 324, 1000 314 L 1000 326 C 988 332, 974 346, 962 364 C 956 378, 950 382, 948 378 C 946 374, 945 372, 944 370 Z" fill="#ffffff" opacity=".9"/>' +
  '<path d="M0 434 C 300 432, 700 436, 830 432 C 880 428, 920 404, 944 370" fill="none" stroke="#e9f6f8" stroke-width="3"/>' +
  '<g id="finStreaks" stroke="#e9f6f8" stroke-width="2.2" stroke-linecap="round" opacity=".55" clip-path="url(#fWater)"></g>' +
  // доска с плавником, трубкой и присоской (свои координаты, масштаб под рост райдера)
  '<g transform="translate(430 263) scale(.43)">' +
    '<path d="M846 386 C 870 372, 892 366, 912 370 M850 390 C 880 384, 905 386, 925 394" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".8"/>' +
    '<use href="#fFinShape" transform="translate(736 391) scale(72)" fill="url(#fFin)"/>' +
    '<path id="finBoardShape" d="M128 344 C 170 353, 232 362, 330 364 C 470 366, 650 369, 780 372 C 816 373, 838 375, 848 378 C 852 382, 851 388, 844 391 C 700 393, 470 393, 340 388 C 250 384, 176 368, 128 344 Z" fill="url(#fRail)" stroke="#000" stroke-width="4" stroke-linejoin="round"/>' +
    '<path d="M150 351 C 230 366, 420 371, 600 374 C 700 375, 790 378, 842 382" fill="none" stroke="#a89d00" stroke-width="2.4" opacity=".8"/>' +
    '<path d="M690 371 L 832 375 C 840 375, 845 371, 846 364 C 846 360, 842 360, 840 364 C 838 368, 834 370, 828 370 L 692 366 Z" fill="#262626"/>' +
    '<path id="finTubeLine" d="M765 393 C 765 384, 752 383, 736 383 L 520 377 C 500 376, 490 372, 488 367" fill="none" stroke="#0f4a57" stroke-width="9" stroke-linecap="round"/>' +
    '<path d="M765 393 C 765 384, 752 383, 736 383 L 520 377 C 500 376, 490 372, 488 367" fill="none" stroke="#9edbe6" stroke-width="3" stroke-linecap="round"/>' +
    '<path id="finTube" d="M488 367 C 490 372, 500 376, 520 377 L 736 383 C 752 383, 765 384, 765 393" fill="none" stroke="none"/>' +
    '<rect x="458" y="357" width="62" height="9" rx="4.5" fill="#000"/>' +
    '<g id="finAirDots"></g>' +
    '<circle cx="782" cy="428" r="56" fill="none" stroke="#fff" stroke-width="4" stroke-dasharray="12 10"/>' +
  '</g>' +
  // вейксёрфер: передняя стопа на присоске, задняя — над плавником
  '<g transform="translate(170 0)">' + '<g fill="#161616"><path d="M542.5 239.6L543.3 241.3L544.2 243.2L545.1 245.4L546.1 247.9L547.1 250.6L548.3 253.5L549.5 256.6L550.8 259.8L552.4 263.1L554 266.4L555.5 270L556.9 273.7L558.2 277.6L559.4 281.6L560.6 285.7L561.7 289.8L562.8 293.9L564 298L565.2 302L566.6 305.9L568 309.7L569.6 313.3L570.9 317L571.8 320.7L573 324.3L574.6 327.9L576.5 331.4L578.6 335L580.8 338.6L582.8 342.3L584.7 346.1L586.1 350.2L587.2 354.4L587.9 358.6L588.5 362.9L589 367.2L589.5 371.3L590.2 375.3L590.9 379.2L591.9 382.8L593.1 386.1L594.3 389.3L595.3 392.4L596.3 395.2L597.2 397.8L598 400.2L598.8 402.3L599.4 404.1L599.7 406.5L599.5 409L598.5 411.2L596.9 413L594.8 414.2L592.5 414.7L590 414.5L587.8 413.5L586 411.9L585 409.7L584.3 407.9L583.4 405.8L582.4 403.4L581.4 400.9L580.2 398.1L579 395.1L577.7 392L576.4 388.7L574.9 385.3L573.2 381.8L571.3 378.3L569.2 374.8L567.2 371.2L565.1 367.5L563.1 363.8L561.2 360L559.6 356.1L558 352.3L556.3 348.5L554.7 344.8L553.1 341.2L551.5 337.7L550 334.3L548.4 331.2L546.8 328L545.1 324.7L543.4 321.3L541.5 318L539.3 314.6L537 311.3L534.5 308L531.9 304.7L529.4 301.4L526.8 298.2L524.3 294.9L522 291.7L519.8 288.4L517.8 285.2L516 281.9L514.2 278.8L512.4 275.9L510.6 273.1L508.8 270.5L507.2 268.1L505.7 265.8L504.4 263.6L503.3 261.6L502.4 259.9L499.8 253.4L499.8 246.4L502 239.7L506.2 234L511.9 229.9L518.6 227.8L525.6 227.8L532.3 230L538 234.2Z"/><path d="M523 265.5L521.1 267.5L518.7 269.8L516.1 272L513.3 274.2L510.2 276.4L507.1 278.7L503.8 281.2L500.6 283.9L497.3 286.7L493.9 289.5L490.3 292.1L486.6 294.7L482.8 297.3L479.1 299.8L475.5 302.4L472.1 305L468.9 307.7L466.1 310.4L463.6 313.1L461.6 315.8L460 318.4L458.4 320.6L457 322.6L456.3 324.4L456.1 326.3L456.4 328.5L457 330.9L457.9 333.6L459.1 336.4L460.3 339.5L461.6 342.7L462.7 346.3L463.6 350L464.5 354L465.3 358.2L466.1 362.4L467.1 366.6L468.2 370.7L469.6 374.7L471.2 378.4L473.1 381.8L474.9 385.1L476.6 388.2L478.2 391.2L479.6 394L480.9 396.6L482 399L482.9 401L483.7 403.3L483.6 405.7L482.7 408L481.1 409.8L479.1 411.1L476.7 411.7L474.3 411.6L472 410.7L470.2 409.1L468.7 407.2L467.9 405.5L467 403.7L465.7 401.5L464.3 399L462.6 396.2L460.7 393.2L458.8 390L456.8 386.6L454.6 383.1L452.2 379.5L449.7 375.8L447.1 372.1L444.6 368.2L442.1 364.3L439.8 360.2L437.8 355.9L436.1 351.6L434.6 347.2L433.3 342.7L432.2 338.2L431.5 333.7L431.1 329L431.1 324.3L431.7 319.6L432.6 314.9L433.7 310.2L435.3 305.6L437.6 301.4L440.1 297.1L442.7 292.9L445.4 288.7L448.1 284.4L451 280.1L453.9 275.8L456.9 271.6L460 267.6L463.1 263.7L466.4 260L469.7 256.6L473 253.5L476.1 250.4L478.9 247.4L481.5 244.6L483.8 242L485.8 239.7L487.4 237.8L488.6 236.4L489.8 235.2L494.9 230.4L501.5 228L508.5 227.6L515.3 229.5L521.2 233.4L525.6 238.9L528 245.5L528.4 252.5L526.5 259.3Z"/><path d="M482 398C485 400 485.5 406.5 486 410C486.5 413.5 487.3 417.3 485 419C482.7 420.7 479.2 419.8 472 420C464.8 420.2 447.5 420.7 442 420C436.5 419.3 438.3 417.5 439 416C439.7 414.5 441.8 412.7 446 411C450.2 409.3 460.3 408.2 464 406C467.7 403.8 465 399.3 468 398C471 396.7 479 396 482 398Z"/><path d="M598 401C601 403 601.5 409.5 602 413C602.5 416.5 603.3 420.3 601 422C598.7 423.7 594.5 422.8 588 423C581.5 423.2 566.8 423.7 562 423C557.2 422.3 558.3 420.5 559 419C559.7 417.5 562.5 415.7 566 414C569.5 412.3 577 411.2 580 409C583 406.8 581 402.3 584 401C587 399.7 595 399 598 401Z"/><path d="M498.5 266.2L498.4 265.8L498.3 265.3L498.2 264.7L498.1 264.1L498 263.6L497.9 263.3L497.9 263.3L497.9 263.4L497.9 263.6L497.9 263.8L497.9 264L497.9 264.1L497.9 264.1L497.8 264.1L497.6 264L497.5 263.8L497.2 263.6L496.9 263.3L496.5 262.9L496 262.5L495.5 262L494.8 261.4L494 260.8L493.2 260.1L492.2 259.2L491.3 258.2L490.4 257.1L489.6 255.8L489.1 254.4L488.7 252.9L488.4 251.4L488 249.7L487.6 248L487.3 246.2L487 244.4L486.7 242.5L486.3 240.6L486 238.7L485.6 236.8L485.3 234.9L484.8 233L484.3 231.2L483.8 229.4L483.2 227.6L482.6 225.8L482 224.1L481.4 222.5L480.9 220.9L480.3 219.3L479.6 217.7L479 216.1L478.4 214.5L477.7 212.9L477.1 211.2L476.4 209.6L475.8 207.9L475.1 206.2L474.5 204.5L473.8 202.8L473.2 201.1L472.5 199.4L471.8 197.8L470.9 196.2L470 194.6L469.1 193.1L468.1 191.6L467.2 190L466.2 188.5L465.3 187.1L464.4 185.6L463.6 184.1L462.8 182.6L462.1 181.2L461.5 179.8L461 178.4L460.5 176.9L460.2 175.4L459.9 174L459.8 172.5L459.7 171L459.6 169.5L459.5 168.1L459.5 166.7L459.4 165.2L459.4 163.9L459.3 162.5L459.1 161.2L458.9 160L458.6 158.8L458.3 157.6L458.1 156.4L458.2 155.2L458.5 153.9L458.9 152.6L459.5 151.3L460.1 150L460.7 148.7L461.3 147.4L461.8 146.1L462.2 144.9L462.4 143.8L462.5 142.7L462.5 141.8L462.2 140.9L462 140L461.9 139.1L461.9 138.2L461.9 137.3L461.9 136.4L461.9 135.6L462 134.8L462 134L462 133.3L462 132.6L462 132L462 131.4L461.9 130.8L461.8 130.3L461.7 129.9L461.6 129.5L460.5 126.1L461 122.5L462.6 119.3L465.2 116.7L468.4 115.1L471.9 114.5L475.5 115L478.7 116.6L481.3 119.2L483.4 122.2L483.5 122.6L483.7 123L483.9 123.5L484.2 124L484.5 124.5L484.9 125L485.3 125.5L485.7 126.1L486.2 126.7L486.8 127.3L487.3 128L487.8 128.6L488.4 129.3L488.9 130.1L489.3 130.9L489.7 131.7L490 132.6L490.6 133.4L491.3 134.2L492.2 134.9L493.2 135.7L494.3 136.4L495.6 137L496.8 137.7L498.1 138.4L499.4 139.2L500.5 140L501.6 140.9L502.4 141.8L502.9 142.9L503.3 144.1L503.8 145.2L504.2 146.4L504.8 147.5L505.3 148.7L505.9 149.9L506.5 151.1L507.1 152.3L507.7 153.5L508.4 154.8L509 156L509.6 157.3L510.1 158.6L510.7 160L511.2 161.3L511.6 162.8L511.9 164.2L512.2 165.7L512.5 167.2L512.7 168.7L512.9 170.3L513.1 172L513.3 173.7L513.5 175.4L513.7 177.1L513.9 178.9L514.2 180.7L514.6 182.4L515 184.2L515.6 186L516.2 187.7L516.9 189.4L517.6 191.2L518.3 192.9L519.1 194.6L519.8 196.4L520.6 198.1L521.4 199.8L522.1 201.6L522.9 203.3L523.6 205L524.4 206.7L525.1 208.5L525.8 210.2L526.5 212.1L527.1 213.9L527.7 215.8L528.4 217.7L529.1 219.6L529.9 221.5L530.8 223.3L531.8 225.1L532.7 226.9L533.7 228.6L534.7 230.3L535.6 232L536.5 233.7L537.3 235.3L538 236.9L538.6 238.5L539.1 240L539.4 241.4L539.3 242.9L538.9 244.4L538.5 245.7L537.9 247L537.4 248.3L537 249.4L536.6 250.4L536.3 251.4L536 252.2L535.8 253L535.7 253.7L535.6 254.3L535.6 254.9L535.6 255.4L535.6 256L535.6 256.5L535.7 257.1L535.7 257.6L535.7 258.1L535.8 258.6L535.8 258.9L535.8 259.1L535.8 258.9L535.7 258.6L535.6 258.2L535.6 257.8L535.5 257.4L535.5 257.3L534.9 263.5L533.5 269.3L530.4 274.4L525.9 278.2L520.4 280.5L514.5 280.9L508.7 279.5L503.6 276.4L499.8 271.9Z"/><path d="M470 73C464.8 72.2 458 73 454 75C450 77 447.7 81.5 446 85C444.3 88.5 445.2 92.7 444 96C442.8 99.3 439.2 102.8 439 105C438.8 107.2 442.5 107.7 443 109C443.5 110.3 441.7 111.7 442 113C442.3 114.3 444.5 115.5 445 117C445.5 118.5 444 120.3 445 122C446 123.7 448.3 126 451 127C453.7 128 457.7 128.5 461 128C464.3 127.5 468.8 123.7 471 124C473.2 124.3 471.8 129 474 130C476.2 131 481.7 133 484 130C486.3 127 487 118 488 112C489 106 490.5 99.3 490 94C489.5 88.7 488.3 83.5 485 80C481.7 76.5 475.2 73.8 470 73Z"/><path d="M452 76C450.7 74.3 456.7 69 460 68C463.3 67 468.3 69.8 472 70C475.7 70.2 478.7 67.7 482 69C485.3 70.3 489.7 74.5 492 78C494.3 81.5 496 86.7 496 90C496 93.3 494 98.7 492 98C490 97.3 488 89.3 484 86C480 82.7 473.3 79.7 468 78C462.7 76.3 453.3 77.7 452 76Z"/><path d="M495.5 144.7L496.5 146.1L497.7 147.7L498.9 149.5L500.1 151.4L501.5 153.6L502.9 155.9L504.4 158.3L505.9 160.8L507.6 163.3L509.4 165.9L511.2 168.6L512.9 171.4L514.6 174.3L516.2 177.1L517.9 180L519.5 182.9L521.2 185.6L522.9 188.2L524.7 190.7L526.5 193L528.5 194.9L530.4 196.6L532.2 198.2L533.7 199.7L535.2 201.1L536.7 202.4L538.3 203.7L540 205L541.8 206.2L543.6 207.3L545.4 208.4L547.3 209.4L549.1 210.5L551 211.5L552.8 212.6L554.6 213.7L556.3 214.8L558 215.8L559.7 216.9L561.4 217.8L563 218.7L564.5 219.6L566 220.4L567.4 221.1L568.7 221.8L570 222.4L571.2 223L572.2 223.5L573.5 224.4L574.4 225.7L574.9 227.2L574.9 228.7L574.5 230.2L573.6 231.5L572.3 232.4L570.8 232.9L569.3 232.9L567.8 232.5L566.9 232.1L565.9 231.6L564.8 231.2L563.5 230.8L562.1 230.3L560.5 229.8L558.8 229.3L557 228.8L555.1 228.3L553.1 227.7L551.1 227L549 226.4L546.9 225.6L544.7 224.7L542.5 223.8L540.3 222.7L538.1 221.6L535.9 220.4L533.6 219.2L531.4 217.9L529.2 216.6L526.9 215.1L524.8 213.6L522.7 211.9L520.6 210L518.6 208L516.6 205.8L514.5 203.5L512.4 201.1L510.2 198.7L507.9 196.2L505.6 193.7L503.3 191.1L501 188.6L498.7 186L496.5 183.4L494.4 180.7L492.4 178.1L490.5 175.5L488.6 173.1L486.6 170.8L484.7 168.7L482.9 166.7L481.2 164.9L479.7 163.2L478.4 161.7L477.4 160.4L476.5 159.3L474.7 156L474 152.3L474.5 148.5L476.1 145.2L478.7 142.5L482 140.7L485.7 140L489.5 140.5L492.8 142.1Z"/><path d="M569 223C572.2 222.7 582 228 586 230C590 232 592 233.2 593 235C594 236.8 593.3 240 592 241C590.7 242 589.2 242.5 585 241C580.8 239.5 569.7 235 567 232C564.3 229 565.8 223.3 569 223Z"/><path d="M484.7 160.3L483.8 161.1L482.9 162.1L481.8 163.3L480.5 164.7L479 166.2L477.4 167.9L475.6 169.8L473.8 171.7L471.9 173.8L470.1 176L468 178.2L465.9 180.3L463.6 182.4L461.2 184.4L458.8 186.4L456.3 188.3L453.9 190.2L451.4 192L449 193.8L446.7 195.5L444.4 197.2L442.1 198.9L439.8 200.5L437.4 201.8L434.8 202.8L432.1 203.5L429.5 204L426.9 204.2L424.3 204.3L421.7 204.3L419.1 204.2L416.6 203.9L414.1 203.6L411.6 203.3L409.2 202.8L406.9 202.1L404.7 201.4L402.5 200.6L400.5 199.7L398.5 198.9L396.7 198.1L394.9 197.3L393.3 196.7L391.8 196.1L390.5 195.7L389.3 195.3L388.3 195.1L387.4 195L385.9 194.5L384.6 193.7L383.6 192.4L383.1 191L383 189.4L383.5 187.9L384.3 186.6L385.6 185.6L387 185.1L388.6 185L389.8 185.2L391.2 185.4L392.7 185.6L394.3 185.9L395.9 186.2L397.7 186.5L399.6 186.8L401.5 187L403.5 187.3L405.5 187.5L407.6 187.8L409.7 188L411.8 188.2L413.8 188.5L415.9 188.7L417.9 188.9L419.8 188.9L421.7 188.8L423.6 188.6L425.3 188.4L426.9 188L428.3 187.6L429.6 187.1L430.8 186.7L432.1 186L433.5 185.2L435.1 184.1L436.8 182.8L438.5 181.3L440.2 179.6L441.9 177.7L443.6 175.6L445.4 173.5L447.1 171.3L448.8 169L450.5 166.8L452.3 164.5L454.1 162.4L455.8 160.2L457.4 158L458.8 155.8L460.2 153.7L461.4 151.6L462.7 149.7L463.9 147.9L465.1 146.3L466.3 144.8L467.3 143.7L470.3 141.4L473.9 140.2L477.6 140.1L481.2 141.2L484.3 143.3L486.6 146.3L487.8 149.9L487.9 153.6L486.8 157.2Z"/><path d="M389 185C386.3 182.5 375.3 180.5 371 180C366.7 179.5 364.7 180.8 363 182C361.3 183.2 360.5 185.8 361 187C361.5 188.2 364.5 188 366 189C367.5 190 366.5 192 370 193C373.5 194 383.8 196.3 387 195C390.2 193.7 391.7 187.5 389 185Z"/><path d="M504 230C509.3 225.7 521.7 225 528 226C534.3 227 539 231.7 542 236C545 240.3 546.7 246.7 546 252C545.3 257.3 542.3 264 538 268C533.7 272 526 275.3 520 276C514 276.7 506 276 502 272C498 268 495.7 259 496 252C496.3 245 498.7 234.3 504 230Z"/><ellipse cx="482" cy="158" rx="17" ry="20" transform="rotate(-20 482 158)"/></g>' +
  '</g>' +
  // прижим
  '<path d="M598 370 L 602 410" stroke="#c2255c" stroke-width="4" marker-end="url(#fA)"/><path d="M678 370 L 674 410" stroke="#c2255c" stroke-width="4" marker-end="url(#fA)"/>' +
  // подписи сцены
  '<g font-size="17" fill="#161616">' +
    '<text x="430" y="300" id="fL4" text-anchor="end"></text>' +
    '<text x="710" y="496" id="fL3" text-anchor="middle" fill="#fff"></text>' +
  '</g>' +
  '<path d="M436 296 L 626 416" stroke="#161616" stroke-width="1.3"/><path d="M710 478 L 710 428" stroke="#fff" stroke-width="1.3"/>' +
  '<text id="finArrowT" x="588" y="372" font-size="17" font-weight="600" fill="#c2255c" text-anchor="end"></text>' +
  // выноска к плавнику крупно
  '<path d="M746 458 L 472 520" stroke="#fff" stroke-width="2" stroke-dasharray="6 5"/>' +
  // плавник крупно: панель
  '<g transform="translate(24 404)">' +
    '<rect width="448" height="182" rx="16" fill="#fbfaf3" stroke="#161616" stroke-width="2"/>' +
    '<text x="18" y="28" font-size="16" font-weight="600" id="finInsetT"></text>' +
    '<rect x="120" y="40" width="250" height="14" fill="url(#fBoard)" stroke="#000" stroke-width="2"/>' +
    '<use href="#fFinShape" transform="translate(150 54) scale(150 118)" fill="url(#fFin)"/>' +
    // канал Вентури: вход на передней кромке, горло посередине хорды, выход на задней кромке
    '<path d="M179 89 C 200 91, 220 97, 232 97 C 248 97, 264 92, 278 92 L 281 114 C 266 112, 248 106, 232 106 C 220 106, 210 110, 202 113 Z" fill="#0f4a57"/>' +
    '<path d="M179 89 C 200 91, 220 97, 232 97 C 248 97, 264 92, 278 92" fill="none" stroke="#f2e400" stroke-width="2.5"/>' +
    '<path d="M202 113 C 210 110, 220 106, 232 106 C 248 106, 266 112, 281 114" fill="none" stroke="#f2e400" stroke-width="2.5"/>' +
    '<path d="M228 98 L 228 50 M 236 98 L 236 50" stroke="#9edbe6" stroke-width="2.5"/>' +
    '<path id="finChan" d="M110 101 C 170 101, 214 102, 232 102 C 252 102, 280 103, 350 108" fill="none" stroke="none"/>' +
    '<path id="finRise" d="M232 99 L 232 46" fill="none" stroke="none"/>' +
    '<g id="finDots"></g>' +
    '<g font-size="13" fill="#161616">' +
      '<text x="112" y="100" text-anchor="end" id="fL1"></text><path d="M116 96 L 178 94" stroke="#161616"/>' +
      '<text x="232" y="168" text-anchor="middle" id="fL2"></text><path d="M232 154 L 232 108" stroke="#161616"/>' +
      '<text x="330" y="80" id="fL5"></text><path d="M326 76 L 242 70" stroke="#161616"/>' +
    '</g>' +
  '</g>' +
  '</svg>';

  function holdAt(k) { return TS.hydro.pump(k / 3.6, DIM); }

  function chart() {
    var W = 320, H = 150, x0 = 34, y0 = 10, w = W - 46, h = H - 36, pts = [], max = 0;
    for (var k = 8; k <= 30; k++) { var q = holdAt(k); pts.push([k, q.kg]); max = Math.max(max, q.kg); }
    max = Math.ceil(max / 10) * 10;
    function X(k) { return x0 + (k - 8) / 22 * w; } function Y(v) { return y0 + h - v / max * h; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="finchart">';
    for (var v = 0; v <= max; v += 10) s += '<line x1="' + x0 + '" x2="' + (x0 + w) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e4e4dd"/><text x="' + (x0 - 5) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    for (var kk = 10; kk <= 30; kk += 5) s += '<text x="' + X(kk) + '" y="' + (y0 + h + 15) + '" text-anchor="middle">' + kk + '</text>';
    s += '<polyline fill="none" stroke="#000" stroke-width="2.5" points="' + pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
    s += '<line id="finMark" x1="' + X(kmh) + '" x2="' + X(kmh) + '" y1="' + y0 + '" y2="' + (y0 + h) + '" stroke="#d4c600" stroke-width="2"/>';
    s += '<text x="' + (x0 + w) + '" y="' + (H - 2) + '" text-anchor="end">' + TS.t('hyKmhU') + '</text></svg>';
    return s;
  }

  function render() {
    var el = $('finPage'); if (!el) return;
    el.innerHTML =
      '<div class="fin-wrap">' +
      '<div class="fin-head"><img src="img/badge.svg" alt="" class="fin-badge"><div><h1>' + TS.t('finTitle') + '</h1><p class="lead">' + TS.t('finLead') + '</p></div></div>' +
      '<div class="fin-stage">' + SVG +
        '<div class="fin-ctl"><label><span>' + TS.t('finSpeed') + '</span><input id="finKmh" type="range" min="8" max="30" step="1" value="' + kmh + '"><b id="finKmhV"></b></label>' +
        '<div class="fin-num"><b id="finKg"></b><span id="finKgN"></span></div></div>' +
      '</div>' +
      '<div class="fin-cols">' +
        '<div><h2>' + TS.t('finHowT') + '</h2><ol class="fin-steps"><li>' + TS.t('finS1') + '</li><li>' + TS.t('finS2') + '</li><li>' + TS.t('finS3') + '</li><li>' + TS.t('finS4') + '</li></ol>' +
        '<h2>' + TS.t('finWhyT') + '</h2><p>' + TS.t('finWhy') + '</p></div>' +
        '<div><h2>' + TS.t('finChartT') + '</h2>' + chart() + '<p class="small">' + TS.t('finChartN') + '</p>' +
        '<p class="small">' + TS.t('finPatent') + '</p>' +
        '<div class="fin-btns"><button id="finCopy">' + TS.t('finCopy') + '</button><button id="finToWater">' + TS.t('finToWater') + '</button></div></div>' +
      '</div></div>';
    $('finSvgT').textContent = TS.t('finTitle');
    $('fL1').textContent = TS.t('finL1'); $('fL2').textContent = TS.t('finL2'); $('fL3').textContent = TS.t('finL3'); $('fL4').textContent = TS.t('finL4');
    $('fL5').textContent = TS.t('finL5'); $('finInsetT').textContent = TS.t('finInset');
    $('finArrowT').textContent = TS.t('finPress');
    $('finKmh').addEventListener('input', function () { kmh = +this.value; numbers(); });
    $('finCopy').addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#fin';
      try { navigator.clipboard.writeText(url); this.textContent = TS.t('finCopied'); } catch (e) { prompt('', url); }
    });
    $('finToWater').addEventListener('click', function () { var t = document.querySelector('.tab[data-tab="hydro"]'); if (TS.state.model && t) t.click(); else TS.newBoard(); });
    // частицы: вода снаружи и в канале, пузырьки воздуха в трубке
    parts = [];
    var dots = $('finDots'), air = $('finAirDots'), streaks = $('finStreaks'), i, c, NS = 'http://www.w3.org/2000/svg';
    for (i = 0; i < 16; i++) { c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 3.2); c.setAttribute('fill', '#7fd0de'); dots.appendChild(c); parts.push({ el: c, kind: 'chan', s: i / 16 }); }
    for (i = 0; i < 4; i++) { c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 2.6); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', '#0f4a57'); dots.appendChild(c); parts.push({ el: c, kind: 'rise', s: i / 4 }); }
    for (i = 0; i < 9; i++) { c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 2.6); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', '#0f4a57'); air.appendChild(c); parts.push({ el: c, kind: 'air', s: i / 9 }); }
    for (i = 0; i < 16; i++) { c = document.createElementNS(NS, 'line'); streaks.appendChild(c); parts.push({ el: c, kind: 'water', s: (i * 0.37) % 1, y: 444 + (i * 29) % 150 }); }
    numbers(); start();
  }

  function numbers() {
    var q = holdAt(kmh);
    $('finKmhV').textContent = kmh + ' ' + TS.t('hyKmhU');
    $('finKg').textContent = '≈ ' + q.kg.toFixed(0) + ' ' + TS.t('hyKgf');
    $('finKgN').textContent = TS.t('finKgN') + ' ' + DIM.pad + ' ' + TS.t('hyCm2') + ' · ' + TS.t('hyVac').toLowerCase() + ' ' + (q.vac / 1000).toFixed(0) + ' ' + TS.t('hyKpa');
    var arr = document.querySelectorAll('#finSvg path[marker-end]');
    for (var ai = 0; ai < arr.length; ai++) arr[ai].setAttribute('stroke-width', (2.5 + q.kg / 6).toFixed(1));
    var m = $('finMark'); if (m) { var x = 34 + (kmh - 8) / 22 * 274; m.setAttribute('x1', x); m.setAttribute('x2', x); }
  }

  function step(ts) {
    if (!document.body || document.body.getAttribute('data-tab') !== 'fin') { raf = null; return; }
    var dt = t0 ? Math.min(0.05, (ts - t0) / 1000) : 0; t0 = ts;
    var v = reduce ? 0 : kmh / 18, chan = $('finChan'), tube = $('finTube'), rise = $('finRise');
    var LC = chan.getTotalLength(), LT = tube.getTotalLength(), LR = rise.getTotalLength();
    parts.forEach(function (p) {
      var pt;
      if (p.kind === 'water') {
        p.s = (p.s + dt * 0.3 * v) % 1;
        var x = -80 + p.s * 1160; p.el.setAttribute('x1', x); p.el.setAttribute('x2', x + 22 + 14 * v); p.el.setAttribute('y1', p.y); p.el.setAttribute('y2', p.y);
      } else if (p.kind === 'chan') {
        var sp = (p.s > 0.36 && p.s < 0.6) ? 2.4 : 1;                      // в сужении быстрее
        p.s = (p.s + dt * 0.4 * v * sp) % 1;
        pt = chan.getPointAtLength(p.s * LC); p.el.setAttribute('cx', pt.x); p.el.setAttribute('cy', pt.y);
      } else if (p.kind === 'rise') {
        p.s = (p.s + dt * 0.35 * v) % 1;                                     // воздух из трубки вниз, в горло
        pt = rise.getPointAtLength((1 - p.s) * LR); p.el.setAttribute('cx', pt.x); p.el.setAttribute('cy', pt.y);
      } else {
        p.s = (p.s + dt * 0.18 * v) % 1;                                     // воздух из-под присоски по трубке к плавнику
        pt = tube.getPointAtLength(p.s * LT); p.el.setAttribute('cx', pt.x); p.el.setAttribute('cy', pt.y);
      }
    });
    raf = requestAnimationFrame(step);
  }
  function start() { if (!raf) { t0 = 0; raf = requestAnimationFrame(step); } }

  TS.finUI = {
    init: function () {
      try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
      render();
    },
    show: function () { if (!parts.length) render(); else { numbers(); start(); } },
    lang: function () { render(); }
  };
})(window.TS = window.TS || {});
