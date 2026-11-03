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
  '<g transform="translate(170 0)">' + '<g fill="#161616"><path d="M561 258L561 260.3L560.8 263.1L560.4 266L559.9 269.1L559.4 272.3L558.7 275.6L558.1 279L557.7 282.6L557.3 286.3L556.9 290.1L556.2 294L555.5 297.8L554.6 301.8L553.7 305.7L552.8 309.6L552 313.5L551.3 317.3L550.9 321L550.7 324.6L550.7 328.1L551.1 331.3L551.4 334.3L551.5 337.2L551.8 339.7L552.7 342.1L554.2 344.4L556 346.8L558.1 349.1L560.4 351.5L562.7 354L564.9 356.7L566.9 359.7L568.8 362.9L570.6 366.2L572.4 369.7L574.3 373.1L576.2 376.5L578.2 379.7L580.3 382.7L582.6 385.4L585.1 387.9L587.4 390.2L589.5 392.4L591.5 394.6L593.4 396.6L595.2 398.5L596.7 400.2L598 401.8L599.1 404L599.7 406.3L599.5 408.8L598.6 411L597.1 412.9L595 414.1L592.7 414.7L590.2 414.5L588 413.6L586.3 411.9L585.2 410.6L583.9 409.2L582.2 407.6L580.3 405.9L578.2 404L576 401.9L573.6 399.6L571 397.2L568.3 394.8L565.4 392.4L562.3 390L559.1 387.5L555.9 385L552.6 382.4L549.5 379.5L546.4 376.6L543.6 373.4L541 370L538.5 366.6L536.1 363.1L533.8 359.6L531.7 355.9L529.8 352.1L528.2 348.3L526.8 344.3L525.5 340.3L524.5 336.1L523.8 331.8L522.9 327.5L522 323.1L521.1 318.7L520.1 314.2L519.2 309.7L518.4 305.2L517.6 300.7L517 296.3L516.6 292L516.4 287.7L516.5 283.7L516.7 279.7L516.7 276L516.6 272.5L516.5 269.2L516.3 266.2L516.2 263.6L516.1 261.4L516 259.6L516 258L516.6 251.1L519.8 244.8L524.7 239.8L531 236.6L538 235.5L544.9 236.6L551.2 239.8L556.2 244.7L559.4 251Z"/><path d="M537.1 276.9L534.8 278.5L531.8 280.2L528.6 281.9L525.2 283.4L521.6 285L517.8 286.6L513.9 288.4L509.9 290.3L506 292.4L501.8 294.4L497.5 296.3L493.2 298.1L488.8 299.8L484.6 301.5L480.4 303.3L476.4 305.1L472.7 307L469.4 309.1L466.5 311.2L464 313.4L462.1 315.5L460.4 317.2L458.9 318.7L457.9 319.9L457.5 321.4L457.5 323.3L457.9 325.7L458.6 328.3L459.6 331.3L460.8 334.4L462.1 337.9L463.3 341.6L464.3 345.5L465.1 349.8L465.9 354.2L466.7 358.8L467.6 363.3L468.6 367.9L469.9 372.2L471.5 376.3L473.3 380.2L475.1 383.8L476.8 387.3L478.4 390.6L479.8 393.7L481.1 396.5L482.2 399.1L483 401.3L483.7 403.6L483.5 406L482.5 408.2L480.9 410L478.8 411.2L476.4 411.7L474 411.5L471.8 410.5L470 408.9L468.5 406.9L467.8 405L466.9 403L465.6 400.6L464.1 397.8L462.4 394.7L460.6 391.4L458.7 387.8L456.6 384L454.3 380.1L451.9 376.1L449.3 372.1L446.7 367.9L444.2 363.7L441.8 359.3L439.6 354.8L437.8 350.2L436.2 345.5L434.9 340.9L433.7 336.1L432.9 331.4L432.4 326.6L432.4 321.8L432.9 316.9L434.1 312.1L435.6 307.3L437.6 302.6L440.1 298.3L443.3 294.5L446.6 290.7L450.1 287.1L453.8 283.4L457.5 279.7L461.4 276.1L465.3 272.5L469.4 269L473.5 265.6L477.6 262.4L481.8 259.5L486 256.8L490.1 254.4L494 252.1L497.6 249.7L500.9 247.5L503.8 245.4L506.4 243.6L508.5 242L510.1 240.9L511.5 239.9L517.5 236.5L524.5 235.5L531.4 236.8L537.6 240.1L542.5 245.2L545.5 251.5L546.5 258.5L545.2 265.4L541.9 271.6Z"/><path d="M482 398C485 400 485.5 406.5 486 410C486.5 413.5 487.3 417.3 485 419C482.7 420.7 479.2 419.8 472 420C464.8 420.2 447.5 420.7 442 420C436.5 419.3 438.3 417.5 439 416C439.7 414.5 441.8 412.7 446 411C450.2 409.3 460.3 408.2 464 406C467.7 403.8 465 399.3 468 398C471 396.7 479 396 482 398Z"/><path d="M598 401C601 403 601.5 409.5 602 413C602.5 416.5 603.3 420.3 601 422C598.7 423.7 594.5 422.8 588 423C581.5 423.2 566.8 423.7 562 423C557.2 422.3 558.3 420.5 559 419C559.7 417.5 562.5 415.7 566 414C569.5 412.3 577 411.2 580 409C583 406.8 581 402.3 584 401C587 399.7 595 399 598 401Z"/><path d="M526.4 285.8L526.5 285.9L526.6 286.1L526.7 286.2L526.6 286.2L526.4 286.1L526 285.9L525.6 285.7L525.1 285.4L524.5 285.1L523.8 284.8L523 284.3L522.1 283.9L521.2 283.4L520.3 282.9L519.2 282.3L518.2 281.7L517 281L515.9 280.2L514.7 279.4L513.6 278.6L512.4 277.6L511.3 276.5L510.2 275.4L509.3 274L508.4 272.5L507.5 270.9L506.8 269.3L506.1 267.7L505.4 266.2L504.8 264.6L504.2 263L503.6 261.5L503.1 259.9L502.5 258.3L502 256.7L501.5 255.1L501 253.5L500.4 252L499.8 250.4L499.3 248.9L498.7 247.4L498 245.9L497.3 244.5L496.6 243.1L495.9 241.8L495 240.6L494.1 239.4L493.2 238.4L492.1 237.3L490.9 236.1L489.6 234.9L488.2 233.7L486.8 232.4L485.3 231.1L483.7 229.7L482.2 228.3L480.6 226.8L479.1 225.3L477.6 223.7L476.1 222L474.6 220.5L472.9 219L471.1 217.6L469.2 216.3L467.3 215L465.4 213.7L463.5 212.4L461.8 211.1L460.1 209.7L458.5 208.3L457 206.8L455.7 205.3L454.6 203.9L453.7 202.6L452.8 201.3L451.9 200L451 198.7L450.1 197.5L449.3 196.2L448.5 195L447.6 193.8L446.8 192.6L445.9 191.5L445.1 190.4L444.2 189.2L443.5 188L442.9 186.6L442.5 185.2L442.3 183.6L442.1 182L441.9 180.3L441.8 178.7L441.7 177L441.5 175.4L441.3 173.9L441 172.4L440.5 170.8L439.9 169.4L439.2 168.1L438.9 166.6L438.8 165L439.1 163.4L439.4 161.7L439.9 160L440.3 158.4L440.7 156.9L440.9 155.5L440.9 154.3L440.6 153.3L440.2 152.3L440 151.3L439.9 150.4L439.8 149.5L439.7 148.6L439.7 147.8L439.6 147.1L439.6 146.5L439.5 146L439.4 145.6L439.2 145.3L438.1 141.7L438.2 137.9L439.4 134.4L441.7 131.4L444.7 129.2L448.3 128.1L452.1 128.2L455.6 129.4L458.6 131.7L460.8 134.7L461.1 135.3L461.4 135.9L461.8 136.5L462.3 137.1L462.8 137.7L463.4 138.3L464 138.9L464.6 139.5L465.2 140.2L465.7 140.9L466.1 141.7L466.6 142.5L467.3 143.1L468.2 143.7L469.3 144.2L470.4 144.7L471.6 145.1L472.8 145.5L473.9 146L474.8 146.5L475.5 147L475.9 147.7L476.5 148.3L477.2 148.8L478 149.3L479 149.8L480 150.2L481.1 150.7L482.2 151.1L483.3 151.5L484.4 152L485.5 152.5L486.5 153.1L487.4 153.8L488.3 154.7L489 155.6L489.9 156.6L490.7 157.6L491.6 158.6L492.6 159.6L493.6 160.7L494.6 161.8L495.6 162.9L496.7 164.1L497.8 165.3L498.9 166.6L500.1 167.9L501.2 169.2L502.1 170.5L503.1 171.9L504 173.5L504.9 175.2L505.9 177L506.8 178.8L507.8 180.8L508.9 182.8L510 184.8L511.1 186.8L512.4 188.7L513.8 190.6L515.3 192.5L516.8 194.3L518.3 196.2L519.7 198.1L521.2 200.1L522.6 202L524 204L525.3 206L526.7 207.9L528 209.9L529.2 211.9L530.5 213.9L531.7 215.9L532.9 217.9L534.1 219.9L535.2 221.9L536.3 223.8L537.4 225.7L538.6 227.5L539.8 229.3L541 231L542.2 232.7L543.3 234.3L544.5 235.8L545.6 237.3L546.7 238.8L547.7 240.2L548.6 241.5L549.5 242.7L550.3 243.9L551.1 244.9L551.7 245.9L552.3 246.7L552.7 247.4L553.1 248L553.3 248.5L553.5 249L553.5 249.6L553.4 250.3L553.2 250.9L553 251.5L552.8 252.1L552.6 252.7L552.4 253.2L552.2 253.7L552 254.2L551.8 254.6L551.7 255L551.7 255.4L551.6 255.8L551.7 256.2L551.8 256.6L551.9 257L552.1 257.4L552.4 257.8L552.8 258.3L553.3 258.9L553.9 259.5L554.6 260.3L555.1 260.8L557.5 266.5L558.9 272.3L558.5 278.2L556.3 283.7L552.5 288.3L547.5 291.5L541.7 292.9L535.8 292.5L530.3 290.3Z"/><path d="M445 93C439.8 92.2 433 93 429 95C425 97 422.7 101.5 421 105C419.3 108.5 420.2 112.7 419 116C417.8 119.3 414.2 122.8 414 125C413.8 127.2 417.5 127.7 418 129C418.5 130.3 416.7 131.7 417 133C417.3 134.3 419.5 135.5 420 137C420.5 138.5 419 140.3 420 142C421 143.7 423.3 146 426 147C428.7 148 432.7 148.5 436 148C439.3 147.5 443.8 143.7 446 144C448.2 144.3 446.8 149 449 150C451.2 151 456.7 153 459 150C461.3 147 462 138 463 132C464 126 465.5 119.3 465 114C464.5 108.7 463.3 103.5 460 100C456.7 96.5 450.2 93.8 445 93Z"/><path d="M427 97C426 95.5 433.3 92 437 91C440.7 90 445.3 90.5 449 91C452.7 91.5 456.2 91.8 459 94C461.8 96.2 464.7 100.7 466 104C467.3 107.3 467.8 112 467 114C466.2 116 463 117.3 461 116C459 114.7 458 108.7 455 106C452 103.3 447.7 101.5 443 100C438.3 98.5 428 98.5 427 97Z"/><path d="M457 94C459 92.7 467.3 94.7 471 96C474.7 97.3 479 100.3 479 102C479 103.7 471.7 104.3 471 106C470.3 107.7 476 111 475 112C474 113 467.7 113.3 465 112C462.3 110.7 460.3 107 459 104C457.7 101 455 95.3 457 94Z"/><path d="M472.1 154.7L473.4 155.2L474.9 155.8L476.6 156.4L478.5 157.2L480.6 158.1L482.8 159L485.1 159.9L487.6 161L490.2 162L492.9 163L495.7 164L498.5 165.1L501.3 166.3L504.2 167.7L507 169.1L509.8 170.5L512.7 171.9L515.4 173.4L518.2 174.8L520.9 176.1L523.6 177.4L526.2 178.5L528.8 179.6L531.3 180.4L533.8 181.3L536.3 182.4L538.7 183.6L541.2 184.9L543.6 186.2L546.1 187.5L548.5 188.8L551 190.2L553.4 191.5L555.8 192.8L558.2 194.2L560.4 195.6L562.6 197.1L564.6 198.6L566.6 200.1L568.5 201.5L570.3 202.9L572 204.2L573.7 205.4L575.2 206.5L576.7 207.4L578 208.3L579.2 209L580.3 209.6L581.6 210.5L582.5 211.8L582.9 213.3L582.9 214.8L582.4 216.3L581.5 217.6L580.2 218.5L578.7 218.9L577.2 218.9L575.7 218.4L574.5 217.8L573.2 217.2L571.8 216.5L570.2 215.7L568.4 214.9L566.6 214.1L564.6 213.2L562.5 212.3L560.4 211.4L558.1 210.4L555.9 209.4L553.5 208.4L551.2 207.2L548.8 206L546.4 204.8L544 203.6L541.5 202.5L539 201.5L536.5 200.4L534.1 199.4L531.7 198.4L529.3 197.4L527 196.3L524.8 195.3L522.5 194.4L520.1 193.4L517.6 192.4L514.9 191.5L512.1 190.6L509.3 189.8L506.3 188.9L503.4 188.1L500.4 187.3L497.4 186.5L494.5 185.6L491.6 184.7L488.7 183.8L486 182.9L483.2 182.1L480.5 181.4L477.9 180.8L475.4 180.3L473 179.8L470.8 179.3L468.8 178.8L467 178.3L465.3 177.8L463.9 177.3L460.6 175.5L458.1 172.7L456.5 169.3L456 165.6L456.7 161.9L458.5 158.6L461.3 156.1L464.7 154.5L468.4 154Z"/><path d="M577 209C580.2 209 590 215.7 594 218C598 220.3 600 221.2 601 223C602 224.8 601.3 228 600 229C598.7 230 597.2 230.8 593 229C588.8 227.2 577.7 221.3 575 218C572.3 214.7 573.8 209 577 209Z"/><path d="M463.8 178.5L462.7 179.1L461.4 179.8L459.9 180.6L458.2 181.4L456.4 182.4L454.4 183.4L452.3 184.4L450 185.6L447.7 186.8L445.4 188.1L442.9 189.5L440.4 190.8L437.7 192L435 193.1L432.2 194.2L429.5 195.3L426.7 196.3L423.9 197.4L421.2 198.4L418.6 199.4L416 200.5L413.6 201.5L411.2 202.7L409 203.9L406.7 204.8L404.3 205.6L401.9 206.2L399.4 206.9L397 207.4L394.5 207.9L392 208.4L389.6 208.9L387.1 209.4L384.7 209.8L382.4 210.1L380 210.3L377.7 210.3L375.5 210.4L373.3 210.4L371.2 210.3L369.2 210.3L367.4 210.3L365.6 210.3L364 210.4L362.5 210.4L361.1 210.6L360 210.7L359 210.9L357.4 211L355.9 210.5L354.6 209.7L353.6 208.4L353.1 207L353 205.4L353.5 203.9L354.3 202.6L355.6 201.6L357 201.1L358.2 200.9L359.5 200.6L360.9 200.3L362.4 200L364 199.6L365.7 199.2L367.5 198.7L369.4 198.3L371.4 197.7L373.4 197.2L375.5 196.6L377.6 196.1L379.8 195.6L382 195.1L384.2 194.6L386.5 194.1L388.7 193.5L390.9 192.9L393.1 192.2L395.2 191.4L397.3 190.7L399.3 189.9L401.3 189.2L403.2 188.5L405.1 187.8L407.1 186.9L409.3 185.9L411.5 184.7L413.8 183.5L416.1 182.1L418.4 180.6L420.7 179.1L423 177.5L425.4 175.9L427.7 174.3L430.1 172.8L432.4 171.3L434.8 169.9L437 168.5L439.1 167L441.1 165.5L443 164L444.8 162.6L446.5 161.3L448.1 160.1L449.6 159.1L451 158.2L452.2 157.5L455.8 156.2L459.5 156.1L463.1 157.1L466.2 159.3L468.5 162.2L469.8 165.8L469.9 169.5L468.9 173.1L466.7 176.2Z"/><path d="M359 201C356 199.2 343.7 199.8 339 200C334.3 200.2 332.7 200.8 331 202C329.3 203.2 328.5 205.8 329 207C329.5 208.2 332.5 208 334 209C335.5 210 334.2 212.7 338 213C341.8 213.3 353.5 213 357 211C360.5 209 362 202.8 359 201Z"/><path d="M522 244C526.7 241.3 537 240.7 542 242C547 243.3 550.2 247.7 552 252C553.8 256.3 554.3 263.3 553 268C551.7 272.7 548.2 277.3 544 280C539.8 282.7 532.7 284.7 528 284C523.3 283.3 518.3 280.3 516 276C513.7 271.7 513 263.3 514 258C515 252.7 517.3 246.7 522 244Z"/><ellipse cx="464" cy="172" rx="17" ry="20" transform="rotate(-35 464 172)"/></g>' +
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
