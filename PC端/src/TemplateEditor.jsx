import React,{useState,useEffect,useRef} from 'react';
import {PlusIcon,ChevronRightIcon,CheckCircledIcon,ArrowLeftIcon,ReloadIcon,TrashIcon} from '@radix-ui/react-icons';
import {Button,Tag,Field,Notice,SectionTitle,Modal,Empty} from './ui';
import {validateWeights} from './domain';
import {createTemplateDraft,regenerateProfessionalWeights,templateSignature,templateIssues,itemReferences,weightTotal} from './template-config';
import './template.css';

const difference=total=>Math.abs(total-100)<.0001?'已合计 100%':total<100?`还差 ${+(100-total).toFixed(4)}%`:`超出 ${+(total-100).toFixed(4)}%`;

export default function TemplateEditor({state:liveState,update:saveUpdate,notify,go,templateGuard,isNew=false}) {
 const [draft,setDraft]=useState(()=>createTemplateDraft(liveState,isNew));
 const [baseline,setBaseline]=useState(()=>JSON.stringify(createTemplateDraft(liveState,isNew)));
 const [selected,setSelected]=useState(isNew?'':'design-1');
 const [collapsed,setCollapsed]=useState({}),[deleting,setDeleting]=useState(false),[attempted,setAttempted]=useState(false),[formError,setFormError]=useState(null);
 const [adding,setAdding]=useState(null),[newName,setNewName]=useState(''),[newKind,setNewKind]=useState('normal'),[newWeight,setNewWeight]=useState(0),[addingParent,setAddingParent]=useState(null),[addError,setAddError]=useState('');
 const editorRef=useRef(null),basicRef=useRef(null),weightsRef=useRef(null),treeRef=useRef(null);
 const state={...liveState,...draft},dirty=JSON.stringify(draft)!==baseline;
 const catalog=[...new Set([...(liveState.professionalCatalog??liveState.professionals),...state.professionals])];
 const update=mutate=>{setFormError(null);setDraft(current=>{const next=structuredClone(current);mutate(next);next.templateStatus='草稿';return next})};
 const d=state.dimensions.find(dim=>dim.id===selected||dim.groups.some(group=>group.id===selected||group.leaves.some(item=>item.id===selected)))||state.dimensions[0];
 const g=d?.groups.find(group=>group.id===selected||group.leaves.some(item=>item.id===selected));
 const leaf=g?.leaves.find(item=>item.id===selected),item=leaf||g||d;
 const normal=state.dimensions.filter(item=>item.kind==='normal'),normalTotal=weightTotal(normal);
 const bad=validateWeights(state.matrix),issues=templateIssues(state);
 const outdated=state.matrixGenerated&&state.matrixSource!==templateSignature(state);
 const references=itemReferences({...state,problems:isNew?[]:liveState.problems},item?.id);
 const path=[d?.name,g?.name,leaf?.name].filter(Boolean).join(' / ');
 const edit=(key,value)=>update(next=>{
  const dim=next.dimensions.find(x=>x.id===d.id),group=dim.groups.find(x=>x.id===g?.id);
  const target=leaf?group.leaves.find(x=>x.id===leaf.id):group||dim;
  target[key]=value;
  if(key==='kind'&&value==='bonus')dim.weight=0;
 });
 useEffect(()=>{
  const warn=e=>{if(dirty){e.preventDefault();e.returnValue=''}};
  window.addEventListener('beforeunload',warn);
  return()=>window.removeEventListener('beforeunload',warn);
 },[dirty]);
 useEffect(()=>{if(templateGuard)templateGuard.current={dirty,save};});
 useEffect(()=>()=>{if(templateGuard)templateGuard.current=null},[]);
 function focusIssue(issue){
  setFormError(issue);notify(issue.message,'error');
  if(issue.id){
   setSelected(issue.id);
   const dim=state.dimensions.find(x=>x.id===issue.id||x.groups.some(group=>group.id===issue.id||group.leaves.some(l=>l.id===issue.id)));
   const group=dim?.groups.find(x=>x.id===issue.id||x.leaves.some(l=>l.id===issue.id));
   setCollapsed(current=>({...current,[dim?.id]:false,[group?.id]:false}));
  }
  requestAnimationFrame(()=>{
   const target=issue.section==='basic'?basicRef.current:issue.section==='matrix'?weightsRef.current:editorRef.current;
   target?.scrollIntoView({block:'center',behavior:'smooth'});
   (target?.querySelector('[aria-invalid="true"]')||target?.querySelector('input,select,button'))?.focus({preventScroll:true});
   treeRef.current?.querySelector('[aria-current="true"]')?.scrollIntoView({block:'nearest'});
  });
  return false;
 }
 function generate(){
  setAttempted(true);
  if(issues.length)return focusIssue(issues[0]);
  if(!state.professionals.length)return focusIssue({section:'basic',message:'请至少选择一个巡检专业'});
  update(next=>Object.assign(next,regenerateProfessionalWeights(next)));
  notify(state.matrixGenerated?'已按最新检查项和参与专业重新生成':'专业权重已生成，请按列配置至 100%');
  requestAnimationFrame(()=>weightsRef.current?.scrollIntoView({block:'start',behavior:'smooth'}));
 }
 function save(enable=false,{navigate=true}={}){
  setAttempted(true);
  const name=state.templateName.trim();
  if(!name)return focusIssue({section:'basic',field:'name',message:'请填写模板名称'});
  if(!state.nodeType)return focusIssue({section:'basic',field:'node',message:'请选择巡检节点类型'});
  if(!state.professionals.length)return focusIssue({section:'basic',message:'请至少选择一个巡检专业'});
  if(state.nodeFrequency==='周期'&&(!Number.isInteger(Number(state.frequencyCount))||Number(state.frequencyCount)<1))return focusIssue({section:'basic',field:'frequency',message:'巡检周期须为正整数'});
  const names=(liveState.savedTemplates||[]).map(item=>item.name);
  if((isNew&&name===liveState.templateName)||names.includes(name))return focusIssue({section:'basic',field:'name',message:'模板名称已存在'});
  if(enable){
   if(issues.length)return focusIssue(issues[0]);
   if(!state.matrixGenerated)return focusIssue({section:'matrix',message:'请先生成专业权重'});
   if(outdated)return focusIssue({section:'matrix',message:'检查项或参与专业已变更，请重新调整专业权重'});
   if(bad.length)return focusIssue({section:'matrix',message:'专业权重矩阵各列合计须为 100%，请调整标红列'});
  }
  const aligned=regenerateProfessionalWeights(state);
  const saved={...draft,templateName:name,templateStatus:enable?'已启用':'草稿',matrix:aligned.matrix,matrixDimensionIds:aligned.matrixDimensionIds,matrixProfessionals:aligned.matrixProfessionals,matrixColumns:aligned.matrixColumns};
  const ok=saveUpdate(next=>{
   next.professionalCatalog=[...catalog];
   if(isNew){
    next.savedTemplates??=[];
    next.savedTemplates.push({...createTemplateDraft(liveState),id:'template-'+Date.now(),name:liveState.templateName,status:liveState.templateStatus,operator:'陈工',date:new Date().toLocaleDateString('sv-SE'),current:false});
   }
   Object.assign(next,saved);
  });
  if(ok===false)return false;
  setDraft(saved);setBaseline(JSON.stringify(saved));setFormError(null);
  if(templateGuard)templateGuard.current.dirty=false;
  if(isNew&&navigate)go('template',{bypass:true});
  notify(enable?'模板已启用，后续节点可引用':'模板草稿已保存');
  return true;
 }
 function openAdd(level,parentId=null){
  setAdding(level);setAddingParent(parentId);setNewName('');setNewKind('normal');setNewWeight(0);setAddError('');
  if(parentId){setSelected(parentId);setCollapsed(current=>({...current,[parentId]:false}))}
 }
 const addingDimension=state.dimensions.find(dim=>dim.id===addingParent||dim.groups.some(group=>group.id===addingParent));
 const addingGroup=addingDimension?.groups.find(group=>group.id===addingParent);
 const addingIsBonus=adding==='一级'?newKind==='bonus':addingDimension?.kind==='bonus';
 const siblingTotal=weightTotal(adding==='一级'?normal:adding==='二级'?(addingDimension?.groups??[]):(addingGroup?.leaves??[]));
 function add(){
  if(!newName.trim())return setAddError('请填写检查项名称');
  if(!addingIsBonus&&(!Number.isFinite(Number(newWeight))||newWeight===''||Number(newWeight)<0||Number(newWeight)>100))return setAddError('检查项权重须在 0 至 100% 之间');
  const weight=addingIsBonus?0:Number(newWeight),id='new-'+crypto.randomUUID();
  update(next=>{
   if(adding==='一级')next.dimensions.push({id,name:newName.trim(),weight,kind:newKind,groups:[]});
   else if(adding==='二级')next.dimensions.find(x=>x.id===addingParent).groups.push({id,name:newName.trim(),weight,leaves:[]});
   else next.dimensions.flatMap(dim=>dim.groups).find(group=>group.id===addingParent).leaves.push({id,name:newName.trim(),weight,deduction:3,descriptionRequired:true,imageRequired:true});
  });
  setAdding(null);setSelected(id);notify('检查项已添加，请继续完善配置');
 }
 function remove(){
  if(references.length)return;
  const nextSelection=leaf?g.id:g?d.id:state.dimensions.find(dim=>dim.id!==d.id)?.id||'';
  update(next=>{
   if(leaf)next.dimensions.find(dim=>dim.id===d.id).groups.find(group=>group.id===g.id).leaves=g.leaves.filter(l=>l.id!==leaf.id);
   else if(g)next.dimensions.find(dim=>dim.id===d.id).groups=d.groups.filter(group=>group.id!==g.id);
   else next.dimensions=next.dimensions.filter(dim=>dim.id!==d.id);
  });
  setDeleting(false);setSelected(nextSelection);notify('检查项已删除，请核对权重并重新生成专业权重');
 }
 const toggle=id=>setCollapsed(current=>({...current,[id]:!current[id]}));
 const sumRow=(label,items)=>{const total=weightTotal(items);return <div className={`template-sum ${Math.abs(total-100)>.0001?'invalid':''}`}><span>{label}合计 <strong>{total}%</strong></span><span>{difference(total)}</span></div>};
 const actions=<><Tag tone={dirty?'orange':'gray'}>{dirty?'未保存':isNew?'尚未保存':'已保存'}</Tag><Button onClick={()=>save()}>保存草稿</Button><Button primary onClick={()=>save(true)}>校验并启用</Button></>;
 return <>
  <div className="page-heading"><div><button className="text-button template-back" onClick={()=>go('templates')}><ArrowLeftIcon/>返回模板列表</button><h2>{isNew?'新增巡检模板':'巡检模板编辑'} <Tag>赋分制</Tag></h2><p>基本信息 → 检查项配置 → 生成专业权重</p></div><Tag tone={state.templateStatus==='已启用'?'green':'gray'}>{state.templateStatus}</Tag></div>
  <section ref={basicRef} className="panel template-basic"><SectionTitle>基本信息</SectionTitle><div className="basic-fields">
   <Field label="模板名称" required><input aria-label="模板名称" aria-invalid={formError?.field==='name'} maxLength={50} placeholder="请输入模板名称" value={state.templateName} onChange={e=>update(next=>next.templateName=e.target.value)}/></Field>
   <Field label="节点类型" required><select aria-label="节点类型" aria-invalid={formError?.field==='node'} value={state.nodeType} onChange={e=>update(next=>next.nodeType=e.target.value)}><option value="">请选择巡检节点类型</option>{state.nodeTypes.filter(name=>state.dictionaryStatuses?.nodeTypes?.[name]!==false||name===state.nodeType).map(name=><option key={name}>{name}</option>)}</select></Field>
   <Field label="计分方式"><span>赋分制 <span className="muted">逐级加权，结果自动计算</span></span></Field>
   <Field label="节点频次" required><div className="template-frequency"><select aria-label="节点频次" value={state.nodeFrequency} onChange={e=>update(next=>next.nodeFrequency=e.target.value)}><option>单次</option><option>周期</option></select>{state.nodeFrequency==='周期'&&<>每<input aria-label="巡检周期" aria-invalid={formError?.field==='frequency'} type="number" min="1" value={state.frequencyCount} onChange={e=>update(next=>next.frequencyCount=e.target.value)}/><select aria-label="周期单位" value={state.frequencyUnit} onChange={e=>update(next=>next.frequencyUnit=e.target.value)}><option>天</option><option>周</option><option>月</option><option>年</option></select>1 次</>}</div></Field>
   <Field label="现场地址"><label className="check-label"><input type="checkbox" checked={state.addressRequired} onChange={e=>update(next=>next.addressRequired=e.target.checked)}/>必填</label></Field>
  </div>
  <fieldset className="template-professionals"><legend>巡检专业 <span className="required">*</span><small>已选 {state.professionals.length} 个</small></legend><div>{catalog.map(name=><label key={name}><input type="checkbox" aria-label={'参与专业：'+name} disabled={state.dictionaryStatuses?.professionals?.[name]===false&&!state.professionals.includes(name)} checked={state.professionals.includes(name)} onChange={e=>update(next=>next.professionals=e.target.checked?catalog.filter(p=>p===name||next.professionals.includes(p)):next.professionals.filter(p=>p!==name))}/>{name}{state.dictionaryStatuses?.professionals?.[name]===false&&<small>（已停用）</small>}</label>)}</div><p>仅为本模板选择参与专业；专业名称在“参数字典”维护。变更后请重新生成专业权重。</p></fieldset>
  {formError?.section==='basic'&&<p className="template-error" role="alert">{formError.message}</p>}</section>
  <section className="panel template-checks"><div className="template-section-head"><SectionTitle aside={<Tag tone={Math.abs(normalTotal-100)<.0001?'green':'orange'}>普通一级权重合计 {normalTotal}%</Tag>}>检查项配置</SectionTitle></div>
   {attempted&&issues.length>0&&<div className="template-issue-list" role="alert"><strong>请完善 {issues.length} 项配置</strong>{issues.map((issue,i)=><button key={i} onClick={()=>focusIssue(issue)}>{issue.message}<ChevronRightIcon/></button>)}</div>}
   <div className="template-layout"><aside ref={treeRef} className="check-tree"><SectionTitle aside={<button className="text-button" onClick={()=>openAdd('一级')}><PlusIcon/>添加一级检查项</button>}>检查项结构</SectionTitle><div className="tree-caption">箭头展开／收起 · 点击名称配置参数</div>
    {state.dimensions.map(dim=><div key={dim.id}>
     <div className={`template-tree-line ${selected===dim.id?'active':''}`}><button className="tree-toggle" aria-label={(collapsed[dim.id]?'展开':'收起')+dim.name} aria-expanded={!collapsed[dim.id]} onClick={()=>toggle(dim.id)}><ChevronRightIcon className={!collapsed[dim.id]?'expanded':''}/></button><button className={`tree-row level-one ${selected===dim.id?'selected':''}`} aria-current={selected===dim.id?'true':undefined} onClick={()=>setSelected(dim.id)} title={dim.name}><strong>{dim.name}</strong><span>{dim.kind==='bonus'?'加分项':dim.weight+'%'}</span></button><button className="tree-add-child" aria-label={'为'+dim.name+'添加二级检查项'} title={'为'+dim.name+'添加二级检查项'} onClick={()=>openAdd('二级',dim.id)}><PlusIcon/>二级</button></div>
     {!collapsed[dim.id]&&dim.groups.map(group=><div key={group.id}><div className={`template-tree-line group ${selected===group.id?'active':''}`}><button className="tree-toggle" aria-label={(collapsed[group.id]?'展开':'收起')+group.name} aria-expanded={!collapsed[group.id]} onClick={()=>toggle(group.id)}><ChevronRightIcon className={!collapsed[group.id]?'expanded':''}/></button><button className={`tree-row level-two ${selected===group.id?'selected':''}`} aria-current={selected===group.id?'true':undefined} onClick={()=>setSelected(group.id)} title={group.name}>{group.name}<span>{dim.kind==='bonus'?'—':group.weight+'%'}</span></button></div>{!collapsed[group.id]&&group.leaves.map(child=><button key={child.id} className={`tree-row level-three ${selected===child.id?'selected':''}`} aria-current={selected===child.id?'true':undefined} onClick={()=>setSelected(child.id)} title={child.name}><i/>{child.name}<span>{dim.kind==='bonus'?'—':child.weight+'%'}</span></button>)}</div>)}
    </div>)}
    {!state.dimensions.length&&<Empty>暂无检查项，点击上方添加一级检查项</Empty>}
   </aside><div ref={editorRef} className="item-editor">{item?<><div className="crumb muted">{path}</div><SectionTitle aside={<div className="actions"><Tag tone="gray">{leaf?'三级检查项':g?'二级检查项':'一级检查项'}</Tag><button className="template-delete text-button" onClick={()=>setDeleting(true)} aria-label={'删除'+item.name}><TrashIcon/>删除</button></div>}>{item.name||'未命名检查项'}</SectionTitle>
    {formError?.id===item.id&&<p className="template-error" role="alert">{formError.message}</p>}
    <div className="editor-form"><Field label="检查项名称" required><input aria-label="检查项名称" value={item.name} onChange={e=>edit('name',e.target.value)}/></Field>
    {!g&&!leaf&&<Field label="检查项类型" required help="普通检查项参与权重计算，加分项单独计分"><select aria-label="检查项类型" value={d.kind} onChange={e=>edit('kind',e.target.value)}><option value="normal">普通检查项</option><option value="bonus">加分项</option></select></Field>}
    {d.kind!=='bonus'&&<><Field label={!g&&!leaf?'一级检查项权重':'同级权重'} required><div className="input-suffix"><input aria-label={!g&&!leaf?'一级检查项权重':'同级权重'} type="number" step="any" min="0" max="100" value={item.weight} onChange={e=>edit('weight',e.target.value===''?'':Number(e.target.value))}/><span>%</span></div></Field>{sumRow(leaf?'本二级下三级权重':g?'本一级下二级权重':'普通一级权重',leaf?g.leaves:g?d.groups:normal)}{!leaf&&sumRow(g?'本项下三级权重':'本项下二级权重',g?g.leaves:d.groups)}</>}
    {leaf?<><Field label={d.kind==='bonus'?'每项加分':'每个问题扣分'} required><div className="input-suffix"><input aria-label={d.kind==='bonus'?'每项加分':'每个问题扣分'} type="number" min="0" step="any" value={leaf.deduction} onChange={e=>edit('deduction',e.target.value===''?'':Number(e.target.value))}/><span>分 / 条</span></div></Field><Field label="问题描述"><label className="check-label"><input type="checkbox" checked={leaf.descriptionRequired} onChange={e=>edit('descriptionRequired',e.target.checked)}/>必填</label></Field><Field label="现场图片"><label className="check-label"><input type="checkbox" checked={leaf.imageRequired} onChange={e=>edit('imageRequired',e.target.checked)}/>必填</label></Field><Notice>移动端按本项配置校验。现场图片最多 5 张，编辑问题时保留已有图片。</Notice><div className="formula-box"><span>本项计分预览</span><p>{d.kind==='bonus'?`亮点条数 × ${leaf.deduction} 分`:`100 − 问题条数 × ${leaf.deduction} 分`}</p><small className="muted">{d.kind==='bonus'?'加分项不参与普通检查项权重分配':'本项得分经同级权重计入上级，系统自动计算'}</small></div></>:<>{d.kind==='bonus'&&<Notice>本项及下级采用加分配置，不参与普通检查项权重分配。</Notice>}{g?<Button onClick={()=>openAdd('三级',g.id)}><PlusIcon/>添加三级检查项</Button>:<p className="template-add-hint">添加二级检查项：点击左侧本项右侧的“＋ 二级”。</p>}</>}
   </div></>:<Empty>请先添加检查项，再在此配置参数</Empty>}</div></div>
   <div className="template-generate"><div><strong>检查项编辑完成后，生成专业权重</strong><p>读取最新检查项与本模板参与专业，按对应项保留已有权重；新增行列待配置，加分项不生成列。</p></div><Button primary onClick={generate}>{state.matrixGenerated?<ReloadIcon/>:<PlusIcon/>}{state.matrixGenerated?'重新调整专业权重':'生成专业权重'}</Button></div>
  </section>
  <section ref={weightsRef} className="panel template-weights"><SectionTitle aside={<Tag tone={!state.matrixGenerated||outdated||bad.length?'orange':'green'}>{!state.matrixGenerated?'尚未生成':outdated?'配置已变更':bad.length?'待配置权重':'各列合计 100%'}</Tag>}>专业权重</SectionTitle>
   {formError?.section==='matrix'&&<p className="template-error" role="alert">{formError.message}</p>}
   {!state.matrixGenerated?<div className="template-weight-empty">完成检查项和参与专业配置后，点击上方“生成专业权重”。</div>:<>
    {outdated&&<Notice tone="warning">检查项或参与专业已变更。下表保留上次生成结果，请点击“重新调整专业权重”后再启用模板。</Notice>}
    <Notice>每个普通一级检查项下，各专业权重合计须为 100%。新增行列初始为 0%，请完成分配。</Notice><div className="table-wrap"><table className="matrix"><thead><tr><th>巡检专业</th>{state.matrixColumns.map((column,j)=><th className={bad.includes(j)?'template-bad-column':''} key={column.id}>{column.name}<small>一级权重 {column.weight}%</small></th>)}</tr></thead><tbody>{state.matrixProfessionals.map((name,i)=><tr key={name}><th>{name}</th>{state.matrixColumns.map((column,j)=><td className={bad.includes(j)?'template-bad-column':''} key={column.id}><div className="matrix-input"><input disabled={outdated} type="number" step="any" min="0" max="100" aria-invalid={bad.includes(j)} aria-label={name+column.name+'权重'} value={state.matrix[i]?.[j]??0} onChange={e=>update(next=>next.matrix[i][j]=e.target.value===''?'':Number(e.target.value))}/><span>%</span></div></td>)}</tr>)}</tbody><tfoot><tr><th>各专业权重合计</th>{state.matrixColumns.map((column,j)=>{const total=state.matrix.reduce((sum,row)=>sum+(Number(row[j])||0),0);return <td className={bad.includes(j)?'error-text':'success-text'} key={column.id}>{+total.toFixed(4)}% {bad.includes(j)?<small>{difference(total)}</small>:<CheckCircledIcon/>}</td>})}</tr></tfoot></table></div>
   </>}
  </section>
  <section className="panel template-rules"><SectionTitle>评分规则说明</SectionTitle><div className="score-flow">三级检查项 100 − 扣分 <ChevronRightIcon/> 二级加权 <ChevronRightIcon/> 专业一级分 <ChevronRightIcon/> 专业矩阵加权 <ChevronRightIcon/> 系统总分</div><p className="muted">普通检查项逐级加权，加分项单独计分。原始分与系统总分只读，运营复核分可调整，等级按分数区间自动换算。</p><Notice tone="warning">待确认：亮点加分加入总分的位置、扣分下限与复核分范围。原型演示为基础总分后统一加分一次，中间值不舍入，展示两位小数。</Notice></section>
  <div className="template-savebar"><span>{dirty?'当前修改尚未保存':'模板配置'}{outdated?' · 专业权重待更新':''}</span><div className="actions">{actions}</div></div>
  {adding&&<Modal title={'添加'+adding+'检查项'} onClose={()=>setAdding(null)} footer={<><Button onClick={()=>setAdding(null)}>取消</Button><Button primary onClick={add}>添加</Button></>}>
   <div className="template-parent-context"><span>{adding==='一级'?'添加位置':'所属检查项'}</span><strong>{adding==='一级'?'模板根目录':[addingDimension?.name,addingGroup?.name].filter(Boolean).join(' / ')}</strong></div>
   <Field label="检查项名称" required><input aria-label="新增检查项名称" maxLength={80} autoFocus value={newName} onChange={e=>{setNewName(e.target.value);setAddError('')}}/></Field>
   {adding==='一级'&&<Field label="检查项类型" required><select aria-label="新增检查项类型" value={newKind} onChange={e=>setNewKind(e.target.value)}><option value="normal">普通检查项</option><option value="bonus">加分项</option></select></Field>}
   {!addingIsBonus?<><Field label="检查项权重" required><div className="input-suffix"><input aria-label="新增检查项权重" type="number" step="any" min="0" max="100" value={newWeight} onChange={e=>{setNewWeight(e.target.value);setAddError('')}}/><span>%</span></div></Field><div className="template-parent-context"><span>已有同级权重 {siblingTotal}% · {difference(siblingTotal)}</span><strong>添加后合计 {+(siblingTotal+(Number(newWeight)||0)).toFixed(4)}%</strong><small>可先添加再调整；启用时同级权重须合计 100%。</small></div></>:<Notice>继承一级加分类型，无需配置普通权重。</Notice>}
   {addError&&<p role="alert" className="template-error">{addError}</p>}
  </Modal>}
  {deleting&&<Modal title={references.length?'检查项已被引用':'删除检查项'} onClose={()=>setDeleting(false)} footer={<><Button onClick={()=>setDeleting(false)}>{references.length?'知道了':'取消'}</Button>{!references.length&&<Button danger onClick={remove}>确认删除</Button>}</>}><p>{path}</p>{references.length?<Notice tone="warning">本项或下级已关联 {references.length} 条巡检问题（{references.map(p=>p.id).join('、')}），不能删除。请保留原项以追溯历史记录。</Notice>:<><Notice tone="warning">将从当前模板草稿中移除此项{!leaf?'及全部下级检查项':''}。保存后生效；未保存时可通过“放弃修改”恢复。</Notice><p>删除后须重新核对同级权重，并更新专业权重。</p></>}</Modal>}
 </>;
}
