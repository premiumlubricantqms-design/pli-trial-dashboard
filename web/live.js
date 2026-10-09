'use strict';
(() => {
  const mobileStyles = document.createElement('link');
  mobileStyles.rel = 'stylesheet'; mobileStyles.href = '/mobile.css';
  document.head.append(mobileStyles);
  const brand = document.querySelector('.brand');
  if (brand) {
    const logo = document.createElement('img');
    logo.src = '/brand-logo.png';
    logo.alt = 'Premium Lubricant';
    logo.className = 'company-logo';
    logo.width = 2048; logo.height = 682;
    brand.querySelector('.mark')?.replaceWith(logo);
    brand.querySelector('strong')?.remove();
  }
  const en = document.documentElement.lang === 'en';
  const t = (th, english) => en ? english : th;
  const get = id => document.getElementById(id);
  const source = get('excelFile').closest('.source');
  const picker = get('excelFile').parentElement;
  const tools = source.querySelector('.tools');
  const indicator = document.createElement('span');
  indicator.setAttribute('role', 'status');
  indicator.style.cssText = 'flex:1;min-width:180px;line-height:1.6';
  source.prepend(indicator);
  const button = (label, fn) => {
    const b = document.createElement('button'); b.textContent = label; b.onclick = fn;
    tools.append(b); return b;
  };
  let mode = 'cloud', currentDigest = null, checking = false, csrf = '';
  picker.hidden = true;
  get('clearFile').hidden = true;
  const language = document.createElement('a');
  language.href = en ? '/th' : '/en'; language.textContent = en ? 'ภาษาไทย' : 'English';
  language.style.cssText = 'padding:10px;color:inherit'; tools.append(language);
  const fallback = button(t('เลือกไฟล์สำรอง', 'Use a local file'), () => {
    mode = 'local'; picker.hidden = false; get('clearFile').hidden = false;
    indicator.textContent = t('โหมดไฟล์สำรอง · ข้อมูลนี้ดูได้เฉพาะอุปกรณ์นี้', 'Local file mode · Data is visible on this device only');
  });
  button(t('กลับไปใช้ OneDrive', 'Use OneDrive'), () => {
    mode = 'cloud'; picker.hidden = true; get('clearFile').hidden = true; currentDigest = null; check();
  });
  button(t('ออกจากระบบ', 'Sign out'), async () => {
    if (!csrf) await check();
    if (!csrf) return;
    await fetch('/logout', {method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({csrf})});
    location.assign('/login');
  });
  get('empty').querySelector('p').textContent = t('กำลังตรวจการเชื่อมต่อ OneDrive…', 'Checking OneDrive connection…');
  const note = get('empty').querySelector('.muted');
  if (note) note.textContent = t('ระบบอ่านเฉพาะชีต Sample Trial Record · ไม่มีข้อมูล Excel อยู่ในโค้ดสาธารณะ', 'Reads Sample Trial Record · Excel data is not included in public source code');
  async function check() {
    if (checking || mode !== 'cloud') return;
    checking = true;
    try {
      const response = await fetch('/api/status', {cache:'no-store'});
      if (response.status === 401) { location.assign('/login'); return; }
      if (!response.ok) throw Error('connection');
      const info = await response.json(); csrf = info.csrf;
      const last = info.last_success ? new Date(info.last_success).toLocaleString(en ? 'en-GB' : 'th-TH', {timeZone:'Asia/Bangkok'}) : '';
      if (info.error === 'not_configured') {
        indicator.textContent = t('ยังไม่ได้เชื่อมต่อ OneDrive · ใช้ไฟล์สำรองได้ระหว่างตั้งค่า', 'OneDrive is not configured · A local file can be used during setup');
        get('liveStatus').textContent = indicator.textContent;
        return;
      }
      if (!info.connected) {
        indicator.textContent = t('เชื่อมต่อ OneDrive ไม่สำเร็จ · ', 'OneDrive connection failed · ') + (last ? t('ข้อมูลล่าสุดที่อ่านสำเร็จ ', 'Last successful read ') + last : t('ยังไม่มีข้อมูล', 'No data available'));
      } else {
        indicator.textContent = 'OneDrive · ' + t('อ่านสำเร็จล่าสุด ', 'Last successful read ') + last + ' · ' + t('ตรวจอัปเดตทุก ', 'Checks every ') + (info.interval_seconds / 60) + t(' นาที', ' minutes');
      }
      if (info.digest && info.digest !== currentDigest && !loading && !printing && !get('detail').open) {
        const dataResponse = await fetch('/api/workbook', {cache:'no-store'});
        if (dataResponse.status === 401) { location.assign('/login'); return; }
        if (!dataResponse.ok) throw Error('download');
        const bytes = await dataResponse.arrayBuffer();
        if (mode !== 'cloud') return;
        const fields = ['search','client','department','status','product','from','to','focus'];
        const saved = Object.fromEntries(fields.map(id => [id,get(id).value]));
        const savedPage = page, savedDrill = chartDrill, scroll = window.scrollY;
        window.pliRemoteFile = new File([bytes], 'Sample Trial Record.xlsx');
        try { await loadLocal(); } finally { window.pliRemoteFile = null; }
        if (!workbook) throw Error('parse');
        for (const id of fields) get(id).value = saved[id];
        chartDrill = savedDrill; page = savedPage; render();
        window.scrollTo({top:scroll,behavior:'instant'});
        // Bind the digest to the bytes actually received, not a possibly older status response.
        currentDigest = dataResponse.headers.get('ETag')?.replaceAll('"','') || info.digest;
      }
      get('liveStatus').textContent = indicator.textContent;
    } catch (_) {
      indicator.textContent = t('ตรวจการอัปเดตไม่สำเร็จ · จะลองใหม่อัตโนมัติ', 'Update check failed · Retrying automatically');
      get('liveStatus').textContent = indicator.textContent;
    } finally { checking = false; }
  }
  indicator.textContent = t('กำลังตรวจการเชื่อมต่อ OneDrive…', 'Checking OneDrive connection…');
  check();
  setInterval(() => { if (!document.hidden) check(); }, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
})();
