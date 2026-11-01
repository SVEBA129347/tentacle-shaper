/* Tentacle Shaper — 3D-вид (three.js r128, WebGL 1 — работает в старом Chrome). GPL v3. */
(function (TS) {
  'use strict';

  function View3D(container) {
    this.el = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio || 1);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xeef2f5);
    this.camera = new THREE.PerspectiveCamera(35, 1, 1, 50000);
    this.camera.up.set(0, 0, 1);
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x6c7a88, 0.6));
    var d1 = new THREE.DirectionalLight(0xffffff, 0.8); d1.position.set(-2, -3, 2.2); this.scene.add(d1);
    var d2 = new THREE.DirectionalLight(0xbfd4e6, 0.35); d2.position.set(3, 2, -1.5); this.scene.add(d2);

    this.group = new THREE.Group(); this.scene.add(this.group);
    var self = this;
    function loop() { requestAnimationFrame(loop); if (self.visible()) { self.resize(); self.controls.update(); self.renderer.render(self.scene, self.camera); } }
    loop();
  }

  View3D.prototype.visible = function () { return this.el.offsetParent !== null; };

  View3D.prototype.resize = function () {
    var w = this.el.clientWidth, h = this.el.clientHeight;
    if (!w || !h) return;
    if (this._w !== w || this._h !== h) {
      this._w = w; this._h = h;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    }
  };

  View3D.prototype.setModel = function (model, keepView) {
    while (this.group.children.length) {
      var o = this.group.children.pop();
      if (o.geometry) o.geometry.dispose();
    }
    var rows = model.mesh(160, 18), nr = rows.length, m = rows[0].length;
    var pos = [], idx = [];
    rows.forEach(function (r) { r.forEach(function (p) { pos.push(p[0], p[1], p[2]); }); });
    for (var i = 0; i < nr - 1; i++)
      for (var j = 0; j < m; j++) {
        var a = i * m + j, b = i * m + (j + 1) % m, c = (i + 1) * m + j, d = (i + 1) * m + (j + 1) % m;
        idx.push(a, c, b, b, c, d);
      }
    // заглушки на торцах (хвост и нос)
    [0, nr - 1].forEach(function (k) {
      var r = rows[k], cx = 0, cz = 0;
      r.forEach(function (p) { cx += p[0]; cz += p[2]; });
      var ci = pos.length / 3; pos.push(cx / m, 0, cz / m);
      for (var j2 = 0; j2 < m; j2++) {
        var p0 = k * m + j2, p1 = k * m + (j2 + 1) % m;
        if (k === 0) idx.push(ci, p0, p1); else idx.push(ci, p1, p0);
      }
    });
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    this.mat = new THREE.MeshStandardMaterial({ color: 0xf0eadc, roughness: 0.6, metalness: 0.0, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.group.add(this.mesh);

    // каркас: продольные и поперечные линии
    var lp = [];
    for (var ii = 0; ii < nr; ii += 8) for (var jj = 0; jj < m; jj++) {
      var q0 = rows[ii][jj], q1 = rows[ii][(jj + 1) % m]; lp.push(q0[0], q0[1], q0[2], q1[0], q1[1], q1[2]);
    }
    for (var j3 = 0; j3 < m; j3 += 3) for (var i3 = 0; i3 < nr - 1; i3++) {
      var s0 = rows[i3][j3], s1 = rows[i3 + 1][j3]; lp.push(s0[0], s0[1], s0[2], s1[0], s1[1], s1[2]);
    }
    var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    this.wire = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0x5b7083, transparent: true, opacity: 0.35 }));
    this.wire.visible = !!this.wireOn;
    this.group.add(this.wire);

    // заданные сечения — цветом
    var sl = [];
    model.sliceX.forEach(function (x) {
      var h = model.section(x, 24), full = h.concat(h.slice(0, -1).reverse().map(function (p) { return [-p[0], p[1]]; }));
      for (var k2 = 0; k2 < full.length - 1; k2++)
        sl.push(x * 10, full[k2][0] * 10, full[k2][1] * 10, x * 10, full[k2 + 1][0] * 10, full[k2 + 1][1] * 10);
    });
    var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sl, 3));
    this.group.add(new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: 0xd9480f })));

    g.computeBoundingBox();
    this.box = g.boundingBox;
    if (!keepView) this.resetView();
  };

  View3D.prototype.setWire = function (on) { this.wireOn = on; if (this.wire) this.wire.visible = on; };

  View3D.prototype.resetView = function () {
    if (!this.box) return;
    var c = new THREE.Vector3(); this.box.getCenter(c);
    var L = this.box.max.x - this.box.min.x;
    this.controls.target.copy(c);
    this.resize();
    var fov = this.camera.fov * Math.PI / 180, asp = this.camera.aspect || 1;
    var dist = (L * 0.5) / Math.tan(fov / 2) / Math.min(1, asp) * 0.85;
    var dir = new THREE.Vector3(-0.35, -0.8, 0.5).normalize();
    this.camera.position.copy(c).addScaledVector(dir, dist);
    this.controls.update();
  };

  TS.View3D = View3D;
})(window.TS = window.TS || {});
