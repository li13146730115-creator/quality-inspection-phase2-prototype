import React,{useState} from 'react';
import {PlusIcon,ChevronRightIcon,CheckCircledIcon,ArrowLeftIcon,ReloadIcon} from '@radix-ui/react-icons';
import {Button,Tag,Field,Notice,SectionTitle,Modal,Empty} from './ui';
import {allLeaves,validateWeights} from './domain';
import {createTemplateDraft,regenerateProfessionalWeights,templateSignature} from './template-config';
import './template.css';

export default function TemplateEditor({state:liveState,update:saveUpdate,notify,go,isNew=false}) {
 const [draft,setDraft]=useState(()=>createTemplateDraft(liveState,isNew));
 const [selected,setSelected]=useState(isNew?'':'design-1');
 const [adding,setAdding]=useState(null),[newName,setNewName]=useState(''),[newKind,setNewKind]=useState('normal');
 const state={...liveState,...draft};
 const update=mutate=>setDraft(current=>{const next=structuredClone(current);mutate(next);next.templateStatus='草稿';return next});
 const d=state.dimensions.find(dim=>dim.id===selected||dim.groups.some(group=>group.id===selected||group.leaves.some(item=>item.id===selected)))||state.dimensions[0];
 const g=d?.groups.find(group=>group.id===selected||group.leaves.some(item=>item.id===selected));
 const leaf=g?.leaves.find(item=>item.id===selected),item=leaf||g||d;
 const normal=state.dimensions.filter(item=>item.kind==='normal');
 const bad=validateWeights(state.matrix);
 const outdated=state.matrixGenerated&&state.matrixSource!==templateSignature(state);
 const edit=(key,value)=>update(next=>{
  const dim=next.dimensions.find(x=>x.id===d.id);
  const group=dim.groups.find(x=>x.id===g?.id);
  const target=leaf?group.leaves.find(x=>x.id===leaf.id):group||dim;
  target[key]=value;
  if(key==='kind'&&value==='bonus')dim.weight=0;
 });
 function structureErrors(){
  const errors=[];
  if(!normal.length)errors.push('请至少添加一个普通检查项');
  if(state.dimensions.some(dim=>!dim.name.trim()||!dim.groups.length||dim.groups.some(group=>!group.name.trim()||!group.leaves.length)))errors.push('请补全各级检查项名称，并为每个二级项添加三级检查项');
  if(allLeaves(state).some(item=>!item.name.trim()||!Number.isFinite(item.deduction)||item.deduction<0))errors.push('请补全末级检查项名称和有效分值');
  const weighted=[...normal,...normal.flatMap(dim=>dim.groups),...normal.flatMap(dim=>dim.groups.flatMap(group=>group.leaves))];
  if(weighted.some(item=>!Number.isFinite(item.weight)||item.weight<0||item.weight>100))errors.push('检查项权重须在 0 至 100% 之间');
  if(Math.abs(normal.reduce((sum,item)=>sum+item.weight,0)-100)>.0001)errors.push('一级普通检查项权重合计须为 100%');
  normal.forEach(dim=>{
   if(Math.abs(dim.groups.reduce((sum,item)=>sum+item.weight,0)-100)>.0001)errors.push(dim.name+'的二级权重须合计 100%');
   dim.groups.forEach(group=>{if(Math.abs(group.leaves.reduce((sum,item)=>sum+item.weight,0)-100)>.0001)errors.push(group.name+'的三级权重须合计 100%')});
  });
  return errors;
 }
 function generate(){
  const errors=structureErrors();
  if(errors.length)return notify(errors[0]);
  if(!state.professionals.length)return notify('请先配置巡检专业');
  update(next=>Object.assign(next,regenerateProfessionalWeights(next)));
  notify(state.matrixGenerated?'已按最新检查项重新生成，请调整专业权重':'专业权重已生成，请按列配置至 100%');
 }
 function save(enable=false){
  const name=state.templateName.trim();
  if(!name)return notify('请填写模板名称');
  if(!state.nodeType)return notify('请选择巡检节点类型');
  const names=(liveState.savedTemplates||[]).map(item=>item.name);
  if((isNew&&name===liveState.templateName)||names.includes(name))return notify('模板名称已存在');
  if(enable){
   const errors=structureErrors();
   if(errors.length)return notify(errors[0]);
   if(!state.matrixGenerated)return notify('请先生成专业权重');
   if(outdated)return notify('检查项已变更，请重新调整专业权重');
   if(bad.length)return notify('专业权重矩阵各列合计须为 100%');
  }
  // Keep saved draft columns aligned even while a regenerated table is still pending.
  const aligned=regenerateProfessionalWeights(state);
  saveUpdate(next=>{
   if(isNew){
    next.savedTemplates??=[];
    next.savedTemplates.push({...createTemplateDraft(liveState),id:'template-'+Date.now(),name:liveState.templateName,status:liveState.templateStatus,operator:'陈工',date:'2026-11-15',current:false});
   }
   Object.assign(next,draft,{
    templateName:name,templateStatus:enable?'已启用':'草稿',
    matrix:aligned.matrix,matrixDimensionIds:aligned.matrixDimensionIds,
    matrixProfessionals:aligned.matrixProfessionals,matrixColumns:aligned.matrixColumns,
   });
  });
  setDraft(current=>({...current,templateName:name,templateStatus:enable?'已启用':'草稿'}));
  if(isNew)go('template');
  notify(enable?'模板已启用，后续节点可引用':'模板草稿已保存');
 }
 function openAdd(level){setAdding(level);setNewName('');setNewKind('normal')}
 function add(){
  if(!newName.trim())return notify('请填写名称');
  const id='new-'+Date.now();
  update(next=>{
   if(adding==='一级')next.dimensions.push({id,name:newName.trim(),weight:0,kind:newKind,groups:[]});
   else if(adding==='二级')next.dimensions.find(x=>x.id===d.id).groups.push({id,name:newName.trim(),weight:0,leaves:[]});
   else next.dimensions.find(x=>x.id===d.id).groups.find(x=>x.id===g.id).leaves.push({id,name:newName.trim(),weight:0,deduction:3,descriptionRequired:true,imageRequired:true});
  });
  setAdding(null);setSelected(id);notify('检查项已添加，请继续完善配置');
 }
 return <>
  <div className="page-heading"><div><button className="text-button template-back" onClick={()=>go('templates')}><ArrowLeftIcon/>返回模板列表</button><h2>{isNew?'新增巡检模板':'巡检模板编辑'} <Tag>赋分制</Tag></h2><p>基本信息 → 检查项配置 → 生成专业权重</p></div><div className="actions"><Tag tone={state.templateStatus==='已启用'?'green':'gray'}>{state.templateStatus}</Tag><Button onClick={()=>save()}>保存草稿</Button><Button primary onClick={()=>save(true)}>校验并启用</Button></div></div>
  <section className="panel template-basic"><SectionTitle>基本信息</SectionTitle><div className="basic-fields"><Field label="模板名称" required><input aria-label="模板名称" maxLength={50} placeholder="请输入模板名称" value={state.templateName} onChange={e=>update(next=>next.templateName=e.target.value)}/></Field><Field label="节点类型" required><select aria-label="节点类型" value={state.nodeType} onChange={e=>update(next=>next.nodeType=e.target.value)}><option value="">请选择巡检节点类型</option>{state.nodeTypes.filter(name=>state.dictionaryStatuses?.nodeTypes?.[name]!==false||name===state.nodeType).map(name=><option key={name}>{name}</option>)}</select></Field><Field label="计分方式"><span>赋分制 <span className="muted">逐级加权，结果自动计算</span></span></Field></div></section>
  <section className="panel template-checks"><div className="template-section-head"><SectionTitle aside={<Tag tone={Math.abs(normal.reduce((sum,item)=>sum+item.weight,0)-100)<.0001?'green':'orange'}>普通一级权重合计 {normal.reduce((sum,item)=>sum+item.weight,0)}%</Tag>}>检查项配置</SectionTitle></div>
   <div className="template-layout"><aside className="check-tree"><SectionTitle aside={<button className="text-button" onClick={()=>openAdd('一级')}><PlusIcon/>添加一级检查项</button>}>检查项结构</SectionTitle><div className="tree-caption">最多三级 · 普通项加权，加分项单独计分</div>
    {state.dimensions.map(dim=><div key={dim.id}><button className={`tree-row level-one ${selected===dim.id?'selected':''}`} onClick={()=>setSelected(dim.id)}><ChevronRightIcon/><strong>{dim.name}</strong><span>{dim.kind==='bonus'?'加分项':dim.weight+'%'}</span></button>{dim.groups.map(group=><div key={group.id}><button className={`tree-row level-two ${selected===group.id?'selected':''}`} onClick={()=>setSelected(group.id)}><ChevronRightIcon/>{group.name}<span>{dim.kind==='bonus'?'—':group.weight+'%'}</span></button>{group.leaves.map(child=><button key={child.id} className={`tree-row level-three ${selected===child.id?'selected':''}`} onClick={()=>setSelected(child.id)}><i/>{child.name}<span>{dim.kind==='bonus'?'—':child.weight+'%'}</span></button>)}</div>)}</div>)}
    {!state.dimensions.length&&<Empty>暂无检查项，点击上方添加一级检查项</Empty>}
   </aside><div className="item-editor">{item?<><div className="crumb muted">{d.name}{g&&' / '+g.name}{leaf&&' / '+leaf.name}</div><SectionTitle aside={<Tag tone="gray">{leaf?'三级检查项':g?'二级检查项':'一级检查项'}</Tag>}>{item.name}</SectionTitle><div className="editor-form"><Field label="检查项名称" required><input aria-label="检查项名称" value={item.name} onChange={e=>edit('name',e.target.value)}/></Field>
    {!g&&!leaf&&<Field label="检查项类型" required help="普通检查项参与权重计算，加分项单独计分"><select aria-label="检查项类型" value={d.kind} onChange={e=>edit('kind',e.target.value)}><option value="normal">普通检查项</option><option value="bonus">加分项</option></select></Field>}
    {d.kind!=='bonus'&&<Field label="同级权重" required help="权重参与上一级加权计算"><div className="input-suffix"><input aria-label="同级权重" type="number" min="0" max="100" value={item.weight} onChange={e=>edit('weight',Number(e.target.value))}/><span>%</span></div></Field>}
    {leaf?<><Field label={d.kind==='bonus'?'每项加分':'每个问题扣分'} required><div className="input-suffix"><input aria-label={d.kind==='bonus'?'每项加分':'每个问题扣分'} type="number" min="0" value={leaf.deduction} onChange={e=>edit('deduction',Number(e.target.value))}/><span>分 / 条</span></div></Field><Field label="问题描述"><label className="check-label"><input type="checkbox" checked={leaf.descriptionRequired} onChange={e=>edit('descriptionRequired',e.target.checked)}/>必填</label></Field><Field label="现场图片"><label className="check-label"><input type="checkbox" checked={leaf.imageRequired} onChange={e=>edit('imageRequired',e.target.checked)}/>必填</label></Field><Notice>移动端按本项配置校验。现场图片最多 5 张，编辑问题时保留已有图片。</Notice><div className="formula-box"><span>本项计分预览</span><p>{d.kind==='bonus'?`亮点条数 × ${leaf.deduction} 分`:`100 − 问题条数 × ${leaf.deduction} 分`}</p><small className="muted">{d.kind==='bonus'?'加分项不参与普通检查项权重分配':'本项得分经同级权重计入上级，系统自动计算'}</small></div></>:<><Notice>{d.kind==='bonus'?'本项及下级采用加分配置，不参与普通检查项的权重分配。':'编辑同级权重后，请校验合计。新增检查项默认权重为 0%，需完成分配。'}</Notice><Button onClick={()=>openAdd(g?'三级':'二级')}><PlusIcon/>添加{g?'三级':'二级'}检查项</Button></>}
   </div></>:<Empty>请先添加检查项，再在此配置参数</Empty>}</div></div>
   <div className="template-generate"><div><strong>检查项编辑完成后，生成专业权重</strong><p>{state.matrixGenerated?'重新调整会读取最新检查项结构、类型、名称与权重；已有对应项的专业权重保留，新增列需配置。':'按照当前普通一级检查项和巡检专业生成权重表，加分项不生成权重列。'}</p></div><Button primary onClick={generate}>{state.matrixGenerated?<ReloadIcon/>:<PlusIcon/>}{state.matrixGenerated?'重新调整专业权重':'生成专业权重'}</Button></div>
  </section>
  <section className="panel template-weights"><SectionTitle aside={<Tag tone={!state.matrixGenerated||outdated||bad.length?'orange':'green'}>{!state.matrixGenerated?'尚未生成':outdated?'检查项已变更':bad.length?'待配置权重':'各列合计 100%'}</Tag>}>专业权重</SectionTitle>
   {!state.matrixGenerated?<div className="template-weight-empty">完成检查项配置后，点击上方“生成专业权重”。</div>:<>
    {outdated&&<Notice tone="warning">检查项配置已变更。下表保留上次生成结果，请点击“重新调整专业权重”读取最新检查项后再启用模板。</Notice>}
    <Notice>每个普通一级检查项下，各专业权重合计须为 100%。新增列初始为 0%，请完成分配。</Notice><div className="table-wrap"><table className="matrix"><thead><tr><th>巡检专业</th>{state.matrixColumns.map(column=><th key={column.id}>{column.name}<small>一级权重 {column.weight}%</small></th>)}</tr></thead><tbody>{state.matrixProfessionals.map((name,i)=><tr key={name}><th>{name}</th>{state.matrixColumns.map((column,j)=><td key={column.id}><div className="matrix-input"><input disabled={outdated} type="number" min="0" max="100" aria-label={name+column.name+'权重'} value={state.matrix[i]?.[j]??0} onChange={e=>update(next=>next.matrix[i][j]=Number(e.target.value))}/><span>%</span></div></td>)}</tr>)}</tbody><tfoot><tr><th>各专业权重合计</th>{state.matrixColumns.map((column,j)=><td className={bad.includes(j)?'error-text':'success-text'} key={column.id}>{state.matrix.reduce((sum,row)=>sum+(row[j]||0),0)}% {bad.includes(j)?'请调整':<CheckCircledIcon/>}</td>)}</tr></tfoot></table></div>
   </>}
  </section>
  <section className="panel template-rules"><SectionTitle>评分规则说明</SectionTitle><div className="score-flow">三级检查项 100 − 扣分 <ChevronRightIcon/> 二级加权 <ChevronRightIcon/> 专业一级分 <ChevronRightIcon/> 专业矩阵加权 <ChevronRightIcon/> 系统总分</div><p className="muted">普通检查项逐级加权，加分项单独计分。原始分与系统总分只读，运营复核分可调整，等级按分数区间自动换算。</p><Notice tone="warning">待确认：亮点加分加入总分的位置、扣分下限与复核分范围。原型演示为基础总分后统一加分一次，中间值不舍入，展示两位小数。</Notice></section>
  {adding&&<Modal title={'添加'+adding+'检查项'} onClose={()=>setAdding(null)} footer={<><Button onClick={()=>setAdding(null)}>取消</Button><Button primary onClick={add}>添加</Button></>}><Field label="检查项名称" required><input aria-label="新增检查项名称" autoFocus value={newName} onChange={e=>setNewName(e.target.value)}/></Field>{adding==='一级'&&<Field label="检查项类型" required><select aria-label="新增检查项类型" value={newKind} onChange={e=>setNewKind(e.target.value)}><option value="normal">普通检查项</option><option value="bonus">加分项</option></select></Field>}</Modal>}
 </>;
}
