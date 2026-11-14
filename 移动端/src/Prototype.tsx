import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import { ArrowLeftIcon, CameraIcon, CheckCircledIcon, ChevronDownIcon, ChevronRightIcon, Cross2Icon, FileTextIcon, InfoCircledIcon, LockClosedIcon, PlusIcon, QuestionMarkCircledIcon, ReaderIcon } from '@radix-ui/react-icons';
import { BottomSheet, Carousel, KeyboardInput, KeyboardTextarea, MobileScroll, useKeyboard, useKeyboardInsets, useMobileDevice } from './mobile';
import { allLeaves, calculate, fmt, loadState, saveState, type InspectionState, type Problem } from './domain';

type Tab = 'info' | 'items' | 'problems';
type Sheet = 'submit' | 'complete' | 'note' | 'discard' | 'image' | null;
type Editor = { problem: Problem; fresh: boolean; readonly: boolean; original: string };
const summarize = (problems: Problem[]) => ({ count: problems.length, deduct: problems.filter(p => p.kind === 'deduct').reduce((n, p) => n + p.deduction, 0), bonus: problems.filter(p => p.kind === 'bonus').reduce((n, p) => n + p.deduction, 0) });
const pcUrl = () => { const url = new URL(window.location.href); const base = import.meta.env.BASE_URL; url.pathname = base.endsWith('/mobile/') ? base.slice(0, -7) : base; url.search = ''; url.hash = 'guide'; if (!base.endsWith('/mobile/') && ['localhost', '127.0.0.1'].includes(url.hostname)) url.port = '4173'; return url.toString(); };

export default function Prototype() {
  const [state, setState] = useState<InspectionState>(loadState);
  const [personId, setPersonId] = useState('p1');
  const [tab, setTab] = useState<Tab>('items');
  const [scope, setScope] = useState<'own' | 'profession'>('own');
  const [expanded, setExpanded] = useState<string[]>(['design', 'landscape']);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [previewImage, setPreviewImage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const keyboard = useKeyboard();
  const { bottomInset } = useKeyboardInsets();
  const { device } = useMobileDevice();
  const me = state.people.find(p => p.id === personId) ?? state.people[0];
  const participants = state.people.filter(p => p.professional === me.professional);
  const authorIds = participants.map(p => p.id);
  const own = state.problems.filter(p => p.author === me.id);
  const professionProblems = state.problems.filter(p => authorIds.includes(p.author));
  const completed = state.completed.includes(me.professional);
  const leaves = allLeaves(state);
  const summary = summarize(own);
  const professionSummary = summarize(professionProblems);
  const currentLeaf = leaves.find(l => l.id === editor?.problem.leafId);
  const currentPeople = participants.filter(p => !p.submitted);
  const result = calculate(state);
  const authorized = state.authorizedProjects.includes('常州国贤府');
  const validation = (problem: Problem, config: InspectionState = state) => {
    const leaf = allLeaves(config).find(l => l.id === problem.leafId);
    const next: Record<string, string> = {};
    if (!leaf) next.leafId = '请选择实际末级检查项';
    if (leaf?.descriptionRequired && !problem.description.trim()) next.description = '请填写问题描述';
    if (leaf?.imageRequired && !problem.images.length) next.images = '此检查项要求至少上传 1 张图片';
    if (!Number.isFinite(problem.deduction) || problem.deduction < 0) next.deduction = '请输入大于或等于 0 的有效分值';
    if (problem.images.length > 5) next.images = '最多上传 5 张图片';
    return next;
  };
  const invalidOwn = own.filter(p => Object.keys(validation(p)).length > 0);

  useEffect(() => {
    const sync = () => setState(loadState());
    window.addEventListener('storage', sync);
    window.addEventListener('inspection-state', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('inspection-state', sync); };
  }, []);
  useEffect(() => { if (!authorized) { keyboard.hide(); setSheet(null); setEditor(null); } }, [authorized]);
  useEffect(() => { if (!toast) return; const timer = window.setTimeout(() => setToast(''), 3500); return () => window.clearTimeout(timer); }, [toast]);
  const persist = (next: InspectionState, message: string) => {
    try { saveState(next); setState(next); setToast(message); return true; }
    catch { setToast('保存失败，当前内容已保留。请减少图片大小后重试。'); return false; }
  };
  const openSheet = (next: Sheet) => { keyboard.hide(); setSheet(next); };
  const toggle = (id: string) => setExpanded(old => old.includes(id) ? old.filter(n => n !== id) : [...old, id]);
  const openProblem = (problem: Problem, fresh = false) => {
    keyboard.hide(); setErrors({});
    const readonly = !fresh && (problem.author !== me.id || problem.submitted || completed);
    const copy = structuredClone(problem);
    setEditor({ problem: copy, fresh, readonly, original: JSON.stringify(copy) });
  };
  const createProblem = (leafId?: string) => {
    if (me.submitted || completed) return;
    const leaf = leaves.find(l => l.id === leafId) ?? leaves[0];
    if (!leaf) { setToast('请先配置末级检查项'); return; }
    openProblem({ id: `P${Date.now()}`, leafId: leaf.id, description: '', images: [], deduction: leaf.deduction, kind: leaf.kind === 'bonus' ? 'bonus' : 'deduct', author: me.id, submitted: false }, true);
  };
  const edit = (patch: Partial<Problem>) => { setEditor(old => old ? { ...old, problem: { ...old.problem, ...patch } } : null); setErrors({}); };
  const closeEditor = () => { keyboard.hide(); if (editor && !editor.readonly && editor.original !== JSON.stringify(editor.problem)) openSheet('discard'); else { setEditor(null); setErrors({}); } };
  const saveProblem = () => {
    if (!editor || editor.readonly || uploading) return;
    keyboard.hide();
    const latest = loadState();
    if (latest.people.find(p => p.id === me.id)?.submitted || latest.completed.includes(me.professional)) { setToast('当前结果已提交，无法继续编辑'); setState(latest); return; }
    const found = validation(editor.problem, latest); setErrors(found);
    if (Object.keys(found).length) { setToast('请完善必填内容后保存'); return; }
    const problem = { ...editor.problem, description: editor.problem.description.trim() };
    const problems = editor.fresh ? [...latest.problems, problem] : latest.problems.map(p => p.id === problem.id ? problem : p);
    if (persist({ ...latest, problems }, editor.fresh ? '问题已保存为草稿' : '修改已保存，问题数量未增加')) { setEditor(null); setTab('problems'); setScope('own'); }
  };
  const readFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []); event.target.value = '';
    if (!editor || !files.length) return;
    if (files.length + editor.problem.images.length > 5) { setErrors({ images: '最多上传 5 张图片，请重新选择' }); return; }
    if (files.some(f => !f.type.startsWith('image/'))) { setErrors({ images: '请选择图片文件' }); return; }
    if (files.some(f => f.size > 2 * 1024 * 1024)) { setErrors({ images: '请选择单张不超过 2MB 的图片' }); return; }
    const uploadProblemId = editor.problem.id;
    setUploading(true);
    try {
      const images = await Promise.all(files.map(file => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('无法读取')); reader.readAsDataURL(file); })));
      setEditor(current => current?.problem.id === uploadProblemId ? { ...current, problem: { ...current.problem, images: [...current.problem.images, ...images].slice(0, 5) } } : current);
      setErrors({});
    } catch { setErrors({ images: '图片读取失败，请重新选择' }); }
    finally { setUploading(false); }
  };
  const submit = () => {
    const latest = loadState(); const problems = latest.problems.filter(p => p.author === me.id);
    if (problems.some(p => Object.keys(validation(p, latest)).length)) { setState(latest); setToast('存在必填内容未完善的问题，请先编辑'); return; }
    if (persist({ ...latest, problems: latest.problems.map(p => p.author === me.id ? { ...p, submitted: true } : p), people: latest.people.map(p => p.id === me.id ? { ...p, submitted: true } : p) }, '个人结果已提交，问题现为只读')) setSheet(null);
  };
  const complete = () => {
    const latest = loadState();
    if (me.role !== '评分人') return;
    if (latest.people.some(p => p.professional === me.professional && !p.submitted)) { setState(latest); setToast('还有参与人员未提交，暂不能完成'); return; }
    if (persist({ ...latest, completed: [...new Set([...latest.completed, me.professional])] }, `${me.professional}巡检已完成`)) setSheet(null);
  };
  const hideOnBlur = (event: React.FocusEvent<HTMLElement>) => { const next = event.relatedTarget as HTMLElement | null; if (!next || !['INPUT', 'TEXTAREA'].includes(next.tagName)) keyboard.hide(); };
  const problemCard = (problem: Problem) => {
    const leaf = leaves.find(l => l.id === problem.leafId);
    const author = state.people.find(p => p.id === problem.author);
    const editable = problem.author === me.id && !problem.submitted && !completed;
    return <button className="problem-card" key={problem.id} onClick={() => openProblem(problem)}>
      <div className="problem-card-top"><span className={`status-tag ${problem.submitted ? 'done' : 'draft'}`}>{problem.submitted ? '已提交' : '草稿'}</span><strong>{leaf?.name ?? '未配置检查项'}</strong><span className={problem.kind === 'bonus' ? 'bonus-number' : 'deduct-number'}>{problem.kind === 'bonus' ? '+' : '−'}{problem.deduction} 分</span></div>
      <p>{problem.description || '尚未填写描述'}</p>
      <div className="problem-card-bottom"><span>{author?.name} · <CameraIcon /> {problem.images.length} 张图片</span><span className={editable ? 'link-color' : ''}>{editable ? '编辑' : '查看'} <ChevronRightIcon /></span></div>
      {!problem.submitted && Object.keys(validation(problem)).length > 0 && <div className="draft-warning">必填内容待完善</div>}
    </button>;
  };
  const metrics = (value: ReturnType<typeof summarize>) => <div className="metrics"><div><b>{value.count}</b><span>问题数</span></div><div><b className="deduct-number">{fmt(value.deduct)}</b><span>累计扣分</span></div><div><b className="bonus-number">{fmt(value.bonus)}</b><span>累计加分</span></div></div>;

  // Authorization is checked after hooks so shared-state changes never alter hook order.
  // No task details, editor, actions, or portalled sheets mount for an unauthorized project.
  if (!authorized) return <>
    <a className="back-pc-link" href={pcUrl()}><ArrowLeftIcon /> 返回 PC 原型</a>
    <div className="inspection-app permission-screen" style={{ '--app-safe-top': `${Math.max(device.geometry.safeArea.top, 54)}px` } as CSSProperties}>
      <div className="permission-content"><LockClosedIcon /><h1>暂无项目访问权限</h1><p>当前账号未获授权查看该项目，请联系管理员配置项目数据权限。</p><a className="primary-button" href={pcUrl()}>返回 PC 原型</a></div>
    </div>
  </>;

  return <>
    <a className="back-pc-link" href={pcUrl()}><ArrowLeftIcon /> 返回 PC 原型</a>
    <div className={`inspection-app ${editor ? 'is-editor' : ''}`} style={{ '--app-safe-top': `${Math.max(device.geometry.safeArea.top, 54)}px`, '--app-bottom': `${bottomInset}px` } as CSSProperties}>
      <header className="inspection-header">
        <div className="app-toolbar"><button className="icon-button" aria-label={editor ? '返回问题列表' : '查看任务基本信息'} onClick={editor ? closeEditor : () => setTab('info')}><ArrowLeftIcon /></button><strong>{editor ? editor.readonly ? '问题详情' : editor.fresh ? '新增问题' : '编辑问题' : '任务详情'}</strong><button className="icon-button" aria-label="查看设计说明" onClick={() => openSheet('note')}><QuestionMarkCircledIcon /></button></div>
        {!editor && <>
          <div className="task-heading"><div className="task-eyebrow">常州国贤府 · 展示区开放</div><div className="task-title"><h1>展示区品质巡检</h1><span className={`status-tag ${completed ? 'done' : 'progress'}`}>{completed ? '条线已完成' : '巡检中'}</span></div><div className="persona-row"><select aria-label="切换巡检人员" value={personId} onFocus={() => keyboard.hide()} onChange={e => { setPersonId(e.target.value); setScope('own'); }}><option value="p1">陈工 · 设计专业 · 评分人</option><option value="p2">王工 · 设计专业 · 拍照人</option><option value="p3">张工 · 工程专业 · 评分人</option></select><ChevronDownIcon /></div></div>
          <nav className="app-tabs" aria-label="任务页签">{([['info', '基本信息'], ['items', '任务检查项'], ['problems', '问题列表']] as const).map(([id, name]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{name}{id === 'problems' && <i>{professionProblems.length}</i>}</button>)}</nav>
        </>}
      </header>
      <div className="inspection-body"><MobileScroll className="inspection-scroll"><main className="inspection-content">
        {editor ? <>
          {editor.readonly && <div className="notice"><LockClosedIcon /><span>{editor.problem.author !== me.id ? '其他人员登记的问题，仅可查看。' : '已提交结果，仅可查看。'}</span></div>}
          <section className="form-card"><label className="form-label">关联检查项 <em>*</em></label>{editor.fresh ? <select aria-label="关联末级检查项" className="leaf-select" value={editor.problem.leafId} onFocus={() => keyboard.hide()} onChange={e => { const leaf = leaves.find(l => l.id === e.target.value)!; edit({ leafId: leaf.id, kind: leaf.kind === 'bonus' ? 'bonus' : 'deduct', deduction: leaf.deduction }); }}>{leaves.map(l => <option value={l.id} key={l.id}>{l.path}</option>)}</select> : <div className="leaf-path">{currentLeaf?.path ?? '未配置检查项'}</div>}{errors.leafId && <p className="field-error">{errors.leafId}</p>}<div className="guidance"><InfoCircledIcon /><span>检查指引：现场核查{currentLeaf?.name}，记录具体位置、现象及影响。</span></div></section>
          <section className="form-card"><label htmlFor="problem-description" className="form-label">问题描述 {currentLeaf?.descriptionRequired && <em>*</em>}</label><KeyboardTextarea id="problem-description" placeholder="请输入现场问题，说明具体位置和问题情况" value={editor.problem.description} readOnly={editor.readonly} onFocus={() => { if (editor.readonly) keyboard.hide(); }} maxLength={500} rows={5} onBlur={hideOnBlur} onChange={e => edit({ description: e.target.value })} /><div className="field-count">{editor.problem.description.length}/500</div>{errors.description && <p className="field-error">{errors.description}</p>}</section>
          <section className="form-card"><div className="form-label">现场图片 {currentLeaf?.imageRequired && <em>*</em>}<span className="label-hint">{editor.problem.images.length}/5</span></div><Carousel className="image-carousel" contentClassName="image-track" ariaLabel="现场图片">{editor.problem.images.map((src, i) => <div className="image-tile" key={`${i}-${src.slice(-12)}`}><button className="preview-image" aria-label={`查看第 ${i + 1} 张图片`} onClick={() => { setPreviewImage(src); openSheet('image'); }}><img src={src} alt={`现场图片 ${i + 1}`} draggable={false} /></button>{!editor.readonly && <button className="image-remove" aria-label={`删除第 ${i + 1} 张图片`} onClick={() => edit({ images: editor.problem.images.filter((_, index) => i !== index) })}><Cross2Icon /></button>}</div>)}{!editor.readonly && editor.problem.images.length < 5 && <button className="upload-tile" onClick={() => { keyboard.hide(); fileRef.current?.click(); }} disabled={uploading}><CameraIcon /><span>{uploading ? '读取中' : '上传图片'}</span></button>}</Carousel><input hidden ref={fileRef} type="file" accept="image/*" multiple aria-label="选择现场图片" onChange={readFiles} />{!editor.problem.images.length && editor.readonly && <p className="muted">暂无现场图片</p>}{!editor.readonly && <p className="field-hint">支持本地图片，最多 5 张，单张不超过 2MB</p>}{errors.images && <p className="field-error">{errors.images}</p>}</section>
          <section className="form-card"><label htmlFor="problem-score" className="form-label">{editor.problem.kind === 'bonus' ? '加分' : '扣分'}分值 <em>*</em></label><div className="score-input-row"><span className={editor.problem.kind === 'bonus' ? 'bonus-number' : 'deduct-number'}>{editor.problem.kind === 'bonus' ? '+' : '−'}</span><KeyboardInput id="problem-score" aria-label={editor.problem.kind === 'bonus' ? '加分分值' : '扣分分值'} type="number" min="0" step="0.1" inputMode="decimal" value={Number.isNaN(editor.problem.deduction) ? '' : editor.problem.deduction} readOnly={editor.readonly} onFocus={() => { if (editor.readonly) keyboard.hide(); }} onBlur={hideOnBlur} onChange={e => edit({ deduction: e.target.value === '' ? NaN : Number(e.target.value) })} /><span>分</span></div>{errors.deduction && <p className="field-error">{errors.deduction}</p>}<p className="field-hint">检查项默认{editor.problem.kind === 'bonus' ? '加分' : '扣分'}：{currentLeaf?.deduction ?? 0} 分</p></section>
          <section className="form-card registration"><span>登记人</span><b>{state.people.find(p => p.id === editor.problem.author)?.name}</b><span>所属专业</span><b>{state.people.find(p => p.id === editor.problem.author)?.professional}</b></section>
        </> : tab === 'items' ? <>
          <div className="section-title"><span><ReaderIcon /> 检查项</span><small>基础 100 分 · 共 {leaves.length} 项</small></div>
          <div className="inspection-tree">{state.dimensions.map((dimension, index) => <section className="dimension-card" key={dimension.id}><button className="dimension-row" onClick={() => toggle(dimension.id)}><span className={`dimension-index ${dimension.kind === 'bonus' ? 'is-bonus' : ''}`}>{String(index + 1).padStart(2, '0')}</span><strong>{dimension.name}</strong><span className="dimension-weight">{dimension.kind === 'bonus' ? '加分项' : `权重 ${dimension.weight}%`}</span>{expanded.includes(dimension.id) ? <ChevronDownIcon /> : <ChevronRightIcon />}</button>{expanded.includes(dimension.id) && dimension.groups.map(group => <div className="tree-group" key={group.id}><button className="group-row" onClick={() => toggle(group.id)}>{expanded.includes(group.id) ? <ChevronDownIcon /> : <ChevronRightIcon />}<strong>{group.name}</strong><span>{dimension.kind === 'bonus' ? '' : `${group.weight}%`}</span></button>{expanded.includes(group.id) && group.leaves.map(leaf => { const records = professionProblems.filter(p => p.leafId === leaf.id); const sum = summarize(records); return <div className="leaf-card" key={leaf.id}><div className="leaf-title"><strong>{leaf.name}</strong><small>{dimension.kind === 'bonus' ? '加分' : `权重 ${leaf.weight}%`}</small></div><p className="leaf-instruction">{dimension.kind === 'bonus' ? '记录创新实践、品质改善与可推广亮点。' : '核查现场质量与体验，发现问题按项登记。'}</p><div className="leaf-stats"><span>问题 <b>{records.length}</b></span><span>{dimension.kind === 'bonus' ? '加分' : '扣分'} <b className={dimension.kind === 'bonus' ? 'bonus-number' : 'deduct-number'}>{dimension.kind === 'bonus' ? '+' : '−'}{dimension.kind === 'bonus' ? sum.bonus : sum.deduct}</b></span>{dimension.kind === 'normal' && <span>得分 <b className="link-color">{fmt(100 - sum.deduct)}</b></span>}</div><div className="leaf-actions"><button className="leaf-problems" onClick={() => { setTab('problems'); setScope('profession'); }}>{records.length ? '查看问题' : '暂无登记问题'} <ChevronRightIcon /></button><button className="small-primary" disabled={me.submitted || completed} onClick={() => createProblem(leaf.id)}><PlusIcon /> {dimension.kind === 'bonus' ? '登记亮点' : '新增问题'}</button></div></div>; })}</div>)}</section>)}</div>
          <p className="content-footnote">分值与巡检状态分别记录；没有问题不代表已完成巡检。</p>
        </> : tab === 'problems' ? <>
          <div className="problem-list-tools"><div className="segmented"><button className={scope === 'own' ? 'active' : ''} onClick={() => setScope('own')}>本人 {own.length}</button><button className={scope === 'profession' ? 'active' : ''} onClick={() => setScope('profession')}>当前条线 {professionProblems.length}</button></div><button className="text-button" disabled={me.submitted || completed} onClick={() => createProblem()}><PlusIcon /> 新增</button></div>
          {me.submitted && <div className="notice"><LockClosedIcon /><span>本人结果已提交，问题仅可查看。</span></div>}
          <div className="problem-list">{(scope === 'own' ? own : professionProblems).map(problemCard)}</div>{!(scope === 'own' ? own : professionProblems).length && <div className="empty-state"><FileTextIcon /><b>暂无问题记录</b><p>现场发现问题后，关联检查项进行登记。</p><button className="small-primary" disabled={me.submitted || completed} onClick={() => createProblem()}>新增问题</button></div>}
        </> : <>
          <section className="info-card"><h2>任务基本信息</h2><dl><dt>所属项目</dt><dd>常州国贤府</dd><dt>巡检类型</dt><dd>展示区开放</dd><dt>巡检日期</dt><dd>2026-11-14</dd><dt>巡检标准</dt><dd>{state.templateName}</dd><dt>任务负责人</dt><dd>陈工</dd><dt>当前专业</dt><dd>{me.professional}</dd><dt>本人角色</dt><dd>{me.role}</dd></dl></section><section className="info-card"><h2>我的巡检结果<span className={`status-tag ${me.submitted ? 'done' : 'draft'}`}>{me.submitted ? '已提交' : '待提交'}</span></h2>{metrics(summary)}<button className="full-text-link" onClick={() => { setTab('problems'); setScope('own'); }}>查看本人问题 <ChevronRightIcon /></button></section><section className="info-card"><h2>专业参与人员 <small>{participants.length} 人</small></h2>{participants.map(person => <div className="participant-line" key={person.id}><div className="avatar">{person.name[0]}</div><div><b>{person.name}</b><small>{person.role}</small></div><span className={`status-tag ${person.submitted ? 'done' : 'draft'}`}>{person.submitted ? '已提交' : '未提交'}</span></div>)}</section>
        </>}
      </main></MobileScroll></div>
      <footer className="app-footer" style={{ bottom: bottomInset }}>
        {editor ? editor.readonly ? <button className="primary-button" onClick={closeEditor}>返回列表</button> : <><button className="secondary-button" onClick={closeEditor}>取消</button><button className="primary-button" disabled={uploading} onClick={saveProblem}>{uploading ? '图片读取中' : '保存问题'}</button></> : <><button className="secondary-button" disabled={me.submitted || completed} onClick={() => openSheet('submit')}>{me.submitted ? <><CheckCircledIcon /> 已提交</> : '提交'}</button><button className="primary-button" disabled={me.role !== '评分人'} onClick={() => openSheet('complete')}>{completed ? '查看完成汇总' : '全部巡检完成'}</button></>}
      </footer>
      {!editor && me.role !== '评分人' && <div className="role-footer-note" style={{ bottom: bottomInset + 68 }}>条线完成由评分人操作</div>}
      {toast && <div className="app-toast" role="status">{toast}</div>}
    </div>
    <BottomSheet open={sheet !== null} onOpenChange={open => { if (!open) setSheet(null); }} title={sheet === 'submit' ? '提交本人巡检结果' : sheet === 'complete' ? `${me.professional}巡检汇总` : sheet === 'discard' ? '放弃未保存的修改？' : sheet === 'image' ? '现场图片' : '原型评审说明'} description={sheet === 'submit' ? '仅提交本人结果，不受其他参与人员状态影响。' : sheet === 'complete' ? '核对条线全部参与人员和巡检结果。' : undefined} snap={sheet === 'discard' ? 0.4 : 0.78}>
      {sheet === 'submit' && <div className="inspection-sheet"><div className="sheet-scroll-content"><div className="summary-person"><div className="avatar">{me.name[0]}</div><div><b>{me.name}</b><span>{me.professional} · {me.role}</span></div></div>{metrics(summary)}<div className="notice"><LockClosedIcon /><span>提交后，本人问题将锁定，不可继续新增或编辑。</span></div><h3>按检查项汇总</h3>{leaves.filter(leaf => own.some(p => p.leafId === leaf.id)).map(leaf => { const value = summarize(own.filter(p => p.leafId === leaf.id)); return <div className="summary-leaf" key={leaf.id}><strong>{leaf.name}</strong><span>{value.count} 个问题</span><b className="deduct-number">−{value.deduct}</b><b className="bonus-number">+{value.bonus}</b></div>; })}{!own.length && <p className="field-hint">本人暂无问题，可提交本次巡检结果。</p>}{invalidOwn.length > 0 && <div className="validation-box"><b>{invalidOwn.length} 个问题的必填内容待完善</b>{invalidOwn.map(p => <button key={p.id} onClick={() => { setSheet(null); openProblem(p); }}>{leaves.find(l => l.id === p.leafId)?.name} · {Object.values(validation(p)).join('、')} <ChevronRightIcon /></button>)}</div>}</div><div className="sheet-actions"><button className="secondary-button" onClick={() => setSheet(null)}>继续检查</button><button className="primary-button" disabled={invalidOwn.length > 0 || me.submitted} onClick={submit}>确认提交</button></div></div>}
      {sheet === 'complete' && <div className="inspection-sheet"><div className="sheet-scroll-content">{completed ? <div className="success-notice"><CheckCircledIcon /> 当前条线巡检已完成</div> : currentPeople.length > 0 ? <div className="validation-box"><b>{currentPeople.map(p => p.name).join('、')} 尚未提交</b><p>请待全部参与人员提交后，再完成本专业巡检。</p></div> : <div className="success-notice"><CheckCircledIcon /> 全部参与人员已提交，可完成巡检</div>}{metrics(professionSummary)}<h3>全部参与人员 · {participants.length} 人</h3>{participants.map(person => { const value = summarize(state.problems.filter(p => p.author === person.id)); return <div className="person-summary-card" key={person.id}><div className="person-summary-head"><div className="avatar">{person.name[0]}</div><div><b>{person.name}</b><small>{person.role}</small></div><span className={`status-tag ${person.submitted ? 'done' : 'draft'}`}>{person.submitted ? '已提交' : '未提交'}</span></div><div className="person-summary-values"><span>问题 <b>{value.count}</b></span><span>扣分 <b className="deduct-number">−{value.deduct}</b></span><span>加分 <b className="bonus-number">+{value.bonus}</b></span></div></div>; })}<h3>条线检查项得分</h3>{state.dimensions.filter(d => d.kind === 'normal').map((d, i) => <div className="dimension-score-line" key={d.id}><span>{d.name}</span><b>{result.ready ? fmt(result.professionalScores[state.professionals.indexOf(me.professional)]?.[i] ?? NaN) : '未完成'}</b></div>)}<p className="field-hint">全部专业完成后，专业得分将在此处及 PC 运营评分中呈现。</p></div><div className="sheet-actions"><button className="secondary-button" onClick={() => setSheet(null)}>返回检查</button><button className="primary-button" disabled={currentPeople.length > 0 || completed || me.role !== '评分人'} onClick={complete}>{completed ? '已完成巡检' : '确认全部完成'}</button></div></div>}
      {sheet === 'note' && <div className="design-note"><p>本原型覆盖任务检查、问题登记、本人提交及条线完成。可在任务标题下切换人员。</p><h3>待业务确认</h3><ul><li>有参与人员未提交时，原型暂按禁止完成演示。</li><li>加分归属及加权位置、分值上下限需最终确认。</li><li>图片编辑后的图库关联处理，需结合原系统实现。</li><li>分值显示 2 位小数；中间计算不舍入。</li></ul><button className="primary-button" onClick={() => setSheet(null)}>知道了</button></div>}
      {sheet === 'discard' && <div className="discard-content"><p>本次内容尚未保存，放弃后将恢复上次保存结果。</p><div className="sheet-actions"><button className="secondary-button" onClick={() => setSheet(null)}>继续编辑</button><button className="primary-button" onClick={() => { keyboard.hide(); setEditor(null); setErrors({}); setSheet(null); }}>放弃修改</button></div></div>}
      {sheet === 'image' && <div className="full-image-preview"><img src={previewImage} alt="现场图片预览" draggable={false} /><button className="primary-button" onClick={() => setSheet(null)}>关闭预览</button></div>}
    </BottomSheet>
  </>;
}
