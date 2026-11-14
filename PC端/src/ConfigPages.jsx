import React, {useEffect, useMemo, useState} from 'react';
import {Button, Tag, Field, Notice, SectionTitle, Modal, Empty, Pagination} from './ui';
import {projects, allLeaves} from './domain';
import './config.css';

const toggleValue=(values,value)=>values.includes(value)?values.filter(v=>v!==value):[...values,value];
const copyGrades=grades=>grades.map(g=>({label:g.label,min:Number.isFinite(g.min)?String(g.min):'',max:g.max===null?'':String(g.max)}));
const uid=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);

function validateGrades(rows) {
 const errors=[];
 const labels=rows.map(row=>row.label.trim());
 const ranges=rows.map((row,index)=>({label:labels[index],min:row.min.trim()===''?-Infinity:Number(row.min),max:row.max.trim()===''?Infinity:Number(row.max),index}));
 ranges.forEach((row,index)=>{
  if(!row.label)errors.push(`第 ${index+1} 行：请填写等级名称。`);
  if(row.label&&labels.indexOf(row.label)!==index)errors.push(`第 ${index+1} 行：等级「${row.label}」重复。`);
  if((rows[index].min!==''&&!Number.isFinite(Number(rows[index].min)))||(rows[index].max!==''&&!Number.isFinite(Number(rows[index].max))))errors.push(`第 ${index+1} 行：上下限须为有效数字。`);
  else if(row.min>=row.max)errors.push(`${row.label||`第 ${index+1} 行`}：下限必须小于上限。`);
 });
 if(ranges.every(r=>!Number.isNaN(r.min)&&!Number.isNaN(r.max)&&r.min<r.max)) {
  const sorted=[...ranges].sort((a,b)=>a.min-b.min);
  if(sorted[0]?.min!==-Infinity)errors.push('最低档下限须留空，以覆盖所有低分。');
  if(sorted.at(-1)?.max!==Infinity)errors.push('最高档上限须留空，以覆盖所有高分。');
  for(let i=1;i<sorted.length;i++) {
   const previous=sorted[i-1],current=sorted[i];
   if(current.min<previous.max)errors.push(`「${previous.label}」与「${current.label}」区间重叠。`);
   if(current.min>previous.max)errors.push(`「${previous.label}」与「${current.label}」之间存在空档（${previous.max}～${current.min}）。`);
  }
 }
 if(!rows.length)errors.push('至少保留一个等级。');
 return [...new Set(errors)];
}

export function GradeConfig({state,update,notify}) {
 const [rows,setRows]=useState(()=>copyGrades(state.grades));
 const [score,setScore]=useState('95');
 const [attempted,setAttempted]=useState(false);
 useEffect(()=>{setRows(copyGrades(state.grades));setAttempted(false)},[state.grades]);
 const errors=useMemo(()=>validateGrades(rows),[rows]);
 const dirty=!same(rows,copyGrades(state.grades));
 const matched=score.trim()!==''&&Number.isFinite(Number(score))?rows.filter(r=>Number(score)>=(r.min===''?-Infinity:Number(r.min))&&Number(score)<(r.max===''?Infinity:Number(r.max))):[];
 const edit=(index,key,value)=>setRows(current=>current.map((row,i)=>i===index?{...row,[key]:value}:row));
 const save=()=>{
  setAttempted(true);
  if(errors.length){notify('等级区间尚有错误，请检查下方校验结果');return;}
  update(draft=>{draft.grades=rows.map(row=>({label:row.label.trim(),min:row.min.trim()===''?-Infinity:Number(row.min),max:row.max.trim()===''?null:Number(row.max)}))});
  notify('等级规则已保存，历史已发布结果不重算');
 };
 return <div className="config-page">
  <Notice tone="warning">以下 A+ 至 D 为待确认的演示区间；正式等级标准以业务确认结果为准。规则变更不重算历史已发布结果。</Notice>
  <div className="config-grade-layout">
   <section className="config-card"><SectionTitle aside={<Button small onClick={()=>setRows([...rows,{label:'',min:'',max:''}])}>＋ 新增等级</Button>}>等级区间配置</SectionTitle>
    <p className="config-caption">采用“下限（含）≤ 分数 ＜ 上限（不含）”；上下限留空分别表示 −∞、＋∞。</p>
    <div className="config-table-wrap"><table className="config-table config-grade-table"><thead><tr><th>等级名称</th><th>下限（含）</th><th>上限（不含）</th><th>操作</th></tr></thead><tbody>{rows.map((row,index)=><tr key={index}><td><input aria-label={`第${index+1}行等级名称`} value={row.label} onChange={e=>edit(index,'label',e.target.value)} maxLength={12}/></td><td><input aria-label={`${row.label||index+1}等级下限（含）`} type="number" step="any" placeholder="−∞" value={row.min} onChange={e=>edit(index,'min',e.target.value)}/></td><td><input aria-label={`${row.label||index+1}等级上限（不含）`} type="number" step="any" placeholder="＋∞" value={row.max} onChange={e=>edit(index,'max',e.target.value)}/></td><td><Button small danger onClick={()=>setRows(rows.filter((_,i)=>i!==index))} disabled={rows.length<=1}>删除</Button></td></tr>)}</tbody></table></div>
    {(dirty||attempted)&&errors.length>0&&<div className="config-errors" role="alert"><strong>请修正 {errors.length} 项配置</strong><ul>{errors.map(error=><li key={error}>{error}</li>)}</ul></div>}
    {!errors.length&&<div className="config-validation">✓ 区间连续、无重叠，等级名称无重复</div>}
   </section>
   <aside className="config-card config-grade-preview"><SectionTitle>等级试算</SectionTitle><p className="config-caption">按左侧当前配置即时匹配，边界分数归入下限相等的等级。</p><Field label="输入复核分"><input type="number" step="any" value={score} onChange={e=>setScore(e.target.value)} placeholder="请输入分数"/></Field><div className="config-grade-result"><span>匹配等级</span><strong>{score.trim()===''?'—':matched.length===1?matched[0].label||'未命名':matched.length>1?'区间重叠':'未配置'}</strong><small>{errors.length?'当前规则存在错误，保存前请修正':'按照当前等级区间自动生成'}</small></div><div className="config-small-note">例如：90 分归入 A，95 分归入 A+。该示例随配置调整，以实时试算结果为准。</div></aside>
  </div>
  <div className="config-footer"><span>{dirty?<Tag tone="orange">未保存</Tag>:<span className="muted">当前规则已保存</span>}</span><div><Button onClick={()=>{setRows(copyGrades(state.grades));setAttempted(false)}} disabled={!dirty}>撤销修改</Button><Button primary onClick={save}>保存等级规则</Button></div></div>
  <p className="config-review-note">评审待确认：规则生效时点与历史快照方案。</p>
 </div>;
}

export function Dictionaries({state,update,notify}) {
 const [tab,setTab]=useState('nodeTypes');
 const [query,setQuery]=useState('');
 const [keyword,setKeyword]=useState('');
 const [editor,setEditor]=useState(null);
 const [name,setName]=useState('');
 const [error,setError]=useState('');
 const [pendingDelete,setPendingDelete]=useState(null);
 const title=tab==='nodeTypes'?'巡检节点类型':tab==='professionals'?'专业条线':'检查项';
 const values=tab==='items'?[]:state[tab];
 const statuses=state.dictionaryStatuses?.[tab]||{};
 const used=value=>tab==='nodeTypes'?(state.nodeType===value):state.people.some(person=>person.professional===value)||state.completed.includes(value)||(state.matrix[state.professionals.indexOf(value)]||[]).some(weight=>weight!==0);
 const references=value=>tab==='nodeTypes'?`模板「${state.templateName}」`:[state.people.some(p=>p.professional===value)&&'巡检人员',state.completed.includes(value)&&'已完成条线',(state.matrix[state.professionals.indexOf(value)]||[]).some(weight=>weight!==0)&&'专业权重矩阵'].filter(Boolean).join('、');
 const rows=values.filter(value=>value.toLowerCase().includes(keyword.toLowerCase()));
 const openEditor=(original=null)=>{setEditor({original});setName(original||'');setError('')};
 const save=()=>{
  const next=name.trim();
  if(!next){setError(`请填写${title}名称`);return;}
  if(values.some(value=>value===next&&value!==editor.original)){setError('名称已存在，请使用其他名称');return;}
  const original=editor.original;
  update(draft=>{
   if(original){
    draft[tab]=draft[tab].map(value=>value===original?next:value);
    if(tab==='nodeTypes'&&draft.nodeType===original)draft.nodeType=next;
    if(tab==='professionals'){
     draft.people=draft.people.map(person=>person.professional===original?{...person,professional:next}:person);
     draft.completed=draft.completed.map(value=>value===original?next:value);
    }
    if(draft.dictionaryStatuses?.[tab]?.[original]!==undefined){draft.dictionaryStatuses[tab][next]=draft.dictionaryStatuses[tab][original];delete draft.dictionaryStatuses[tab][original]}
   }else{
    draft[tab].push(next);
    if(tab==='professionals'){
     draft.matrix.push(draft.dimensions.filter(d=>d.kind==='normal').map(()=>0));
     draft.templateStatus='草稿';
    }
   }
  });
  setEditor(null);
  notify(!original&&tab==='professionals'?'专业已新增，矩阵已补充 0 权重行，请重新配置各列权重':`${title}已${original?'更新':'新增'}`);
 };
 const setEnabled=value=>{
  update(draft=>{draft.dictionaryStatuses??={};draft.dictionaryStatuses[tab]??={};draft.dictionaryStatuses[tab][value]=statuses[value]===false});
  notify(statuses[value]===false?'已启用':used(value)?'已停用，现有引用和历史名称保留':'已停用');
 };
 const remove=value=>{
  if(used(value)){notify(`无法删除：已被${references(value)}引用`);setPendingDelete(null);return;}
  update(draft=>{
   const index=draft[tab].indexOf(value);
   draft[tab].splice(index,1);
   if(tab==='professionals')draft.matrix.splice(index,1);
   if(draft.dictionaryStatuses?.[tab])delete draft.dictionaryStatuses[tab][value];
  });setPendingDelete(null);notify('已删除未引用的字典项');
 };
 const move=(value,offset)=>{
  const index=values.indexOf(value),next=index+offset;
  if(next<0||next>=values.length)return;
  update(draft=>{[draft[tab][index],draft[tab][next]]=[draft[tab][next],draft[tab][index]];if(tab==='professionals')[draft.matrix[index],draft.matrix[next]]=[draft.matrix[next],draft.matrix[index]]});notify('字典顺序已更新');
 };
 return <div className="config-page"><div className="config-tabs" role="tablist" aria-label="参数字典类型">{[['nodeTypes','巡检节点类型'],['professionals','专业条线'],['items','检查项']].map(([key,label])=><button key={key} role="tab" aria-selected={tab===key} className={tab===key?'active':''} onClick={()=>{setTab(key);setQuery('');setKeyword('')}}>{label}</button>)}</div>
  {tab==='items'?<section className="config-card"><SectionTitle>检查项配置</SectionTitle><Notice>新制度检查项按模板维护。请进入“巡检模板”中的“检查项与权重”配置分级名称、权重、每问题扣分及必填规则。</Notice><div className="config-dictionary-summary"><strong>{state.templateName}</strong><span>{state.dimensions.filter(d=>d.kind==='normal').length} 个一级普通项</span><span>{allLeaves(state).length} 个末级检查项</span><Tag>分值制</Tag></div><div className="config-table-wrap"><table className="config-table"><thead><tr><th>一级检查项</th><th>类型</th><th>权重</th><th>二级项数量</th><th>末级项数量</th></tr></thead><tbody>{state.dimensions.map(d=><tr key={d.id}><td>{d.name}</td><td><Tag tone={d.kind==='bonus'?'orange':'blue'}>{d.kind==='bonus'?'加分项':'普通项'}</Tag></td><td>{d.kind==='normal'?`${d.weight}%`:'不配置'}</td><td>{d.groups.length}</td><td>{d.groups.reduce((sum,g)=>sum+g.leaves.length,0)}</td></tr>)}</tbody></table></div><p className="config-review-note">历史等级制检查项仅供查看；此处不再提供旧等级标准编辑。</p></section>:<>
   <Notice>{tab==='nodeTypes'?'节点类型为系统级字典，用于巡检模板引用。':'专业条线为系统级字典，与城市人员配置分开维护。新增专业后，请在模板专业权重矩阵重新分配权重。'} 已引用条目不可删除；停用保留现有引用。</Notice>
   <section className="config-card"><form className="config-toolbar" onSubmit={e=>{e.preventDefault();setKeyword(query.trim())}}><label>名称<input aria-label={`${title}查询`} value={query} onChange={e=>setQuery(e.target.value)} placeholder={`请输入${title}`}/></label><Button primary type="submit">查询</Button><Button type="button" onClick={()=>{setQuery('');setKeyword('')}}>重置</Button><Button type="button" className="config-toolbar-end" primary onClick={()=>openEditor()}>＋ 新增{title}</Button></form>
    <div className="config-table-wrap"><table className="config-table"><thead><tr><th className="config-index">序号</th><th>{title}名称</th><th>状态</th><th>引用情况</th><th className="config-operations">操作</th></tr></thead><tbody>{rows.map(value=><tr key={value}><td>{values.indexOf(value)+1}</td><td><strong className="config-normal-weight">{value}</strong></td><td><Tag tone={statuses[value]===false?'gray':'green'}>{statuses[value]===false?'已停用':'已启用'}</Tag></td><td>{used(value)?<span>{references(value)}</span>:<span className="muted">暂无业务引用</span>}</td><td><div className="config-row-actions"><button onClick={()=>openEditor(value)}>编辑</button><button onClick={()=>setEnabled(value)}>{statuses[value]===false?'启用':'停用'}</button><button disabled={values.indexOf(value)===0} onClick={()=>move(value,-1)}>上移</button><button disabled={values.indexOf(value)===values.length-1} onClick={()=>move(value,1)}>下移</button><button className="config-text-danger" onClick={()=>setPendingDelete(value)}>删除</button></div></td></tr>)}</tbody></table>{!rows.length&&<Empty/>}</div><Pagination count={rows.length}/>
   </section></>}
  {editor&&<Modal title={`${editor.original?'编辑':'新增'}${title}`} width={520} onClose={()=>setEditor(null)} footer={<><Button onClick={()=>setEditor(null)}>取消</Button><Button primary onClick={save}>保存</Button></>}><div className="config-form"><Field label={`${title}名称`} required><input autoFocus value={name} maxLength={30} onChange={e=>{setName(e.target.value);setError('')}} placeholder="请输入名称"/>{error&&<small className="config-error" role="alert">{error}</small>}</Field>{editor.original&&used(editor.original)&&<Notice>该名称已有引用，修改后同步更新当前模板、人员与矩阵的显示名称；不删除历史数据。</Notice>}{!editor.original&&tab==='professionals'&&<Notice tone="warning">新增专业将添加至当前模板，并补充 0 权重矩阵行。模板恢复为草稿，请重新配置各列权重并完成条线巡检。</Notice>}</div></Modal>}
  {pendingDelete&&<Modal title={used(pendingDelete)?'字典项已被引用':'删除字典项'} width={480} onClose={()=>setPendingDelete(null)} footer={used(pendingDelete)?<Button primary onClick={()=>setPendingDelete(null)}>知道了</Button>:<><Button onClick={()=>setPendingDelete(null)}>取消</Button><Button danger onClick={()=>remove(pendingDelete)}>确认删除</Button></>}><p>「{pendingDelete}」{used(pendingDelete)?`已被${references(pendingDelete)}引用，无法删除。可停用该字典项，保留现有引用。`:'没有业务引用，确认删除该条目？'}</p></Modal>}
 </div>;
}

const roleOptions=[{name:'品质管理员',members:8,note:'负责巡检模板与集团品质管理'},{name:'城市巡检负责人',members:12,note:'负责城市公司品质巡检统筹'},{name:'项目巡检员',members:36,note:'负责项目日常巡检执行'}];

export function Permissions({state,update,notify}) {
 const [initialScopes]=useState(()=>Object.fromEntries(roleOptions.map((item,index)=>[item.name,index===0?[...state.authorizedProjects]:[]])));
 const [role,setRole]=useState(roleOptions[0].name);
 const [selected,setSelected]=useState(()=>[...(state.roleProjectScopes?.[roleOptions[0].name]||state.authorizedProjects)]);
 const [city,setCity]=useState('');
 const [query,setQuery]=useState('');
 const [filter,setFilter]=useState({city:'',query:''});
 const [nextRole,setNextRole]=useState(null);
 const saved=state.roleProjectScopes?.[role]||initialScopes[role];
 const dirty=!same([...selected].sort(),[...saved].sort());
 const visible=projects.filter(p=>(!filter.city||p.city===filter.city)&&p.name.includes(filter.query));
 const cities=[...new Set(projects.map(p=>p.city))];
 const allSelected=visible.length>0&&visible.every(p=>selected.includes(p.name));
 const activate=name=>{setRole(name);setSelected([...(state.roleProjectScopes?.[name]||initialScopes[name])]);setNextRole(null)};
 const save=()=>{update(draft=>{draft.authorizedProjects=[...selected];draft.roleProjectScopes={...initialScopes,...draft.roleProjectScopes,[role]:[...selected]}});notify(`已保存「${role}」的 ${selected.length} 个项目，角色成员继承该授权`)};
 return <div className="config-page"><Notice>按角色配置项目数据权限，保存后角色成员继承已选项目。巡检计划的“全部授权项目”同步按当前保存的项目范围展示。</Notice><div className="config-permission-layout">
  <aside className="config-card config-role-panel"><SectionTitle>角色列表</SectionTitle><div className="config-role-list">{roleOptions.map(item=><button className={role===item.name?'active':''} key={item.name} onClick={()=>{if(item.name===role)return;if(dirty)setNextRole(item.name);else activate(item.name)}}><span>{item.name}</span><small>{item.members} 名成员</small></button>)}</div><p className="config-small-note">角色与人数为演示数据。</p></aside>
  <section className="config-card config-project-panel"><SectionTitle aside={<Tag>{roleOptions.find(r=>r.name===role)?.members} 名成员</Tag>}>{role} · 项目数据权限</SectionTitle><div className="config-subtabs"><span>功能权限（沿用现有配置）</span><strong>项目数据权限</strong></div>
   <form className="config-toolbar" onSubmit={e=>{e.preventDefault();setFilter({city,query:query.trim()})}}><label>城市公司<select aria-label="筛选城市公司" value={city} onChange={e=>setCity(e.target.value)}><option value="">全部城市公司</option>{cities.map(value=><option key={value}>{value}</option>)}</select></label><label>项目名称<input aria-label="搜索项目名称" placeholder="请输入项目名称" value={query} onChange={e=>setQuery(e.target.value)}/></label><Button primary type="submit">查询</Button><Button type="button" onClick={()=>{setCity('');setQuery('');setFilter({city:'',query:''})}}>重置</Button></form>
   <div className="config-project-selection"><div className="config-project-source"><div className="config-selection-heading"><label><input type="checkbox" checked={allSelected} onChange={()=>setSelected(allSelected?selected.filter(name=>!visible.some(p=>p.name===name)):[...new Set([...selected,...visible.map(p=>p.name)])])}/>全选当前结果</label><span>{visible.length} 个项目</span></div><div className="config-table-wrap"><table className="config-table"><thead><tr><th>选择</th><th>项目名称</th><th>城市公司</th></tr></thead><tbody>{visible.map(project=><tr key={project.code}><td><input aria-label={`授权${project.name}`} type="checkbox" checked={selected.includes(project.name)} onChange={()=>setSelected(toggleValue(selected,project.name))}/></td><td>{project.name}<small className="config-cell-sub">{project.code}</small></td><td>{project.city}</td></tr>)}</tbody></table>{!visible.length&&<Empty/>}</div></div><aside className="config-selected-projects"><div className="config-selection-heading"><strong>已选项目 <span className="config-blue">{selected.length}</span></strong><button disabled={!selected.length} onClick={()=>setSelected([])}>清空</button></div>{selected.length?<ul>{selected.map(name=><li key={name}><span>{name}<small>{projects.find(p=>p.name===name)?.city||'已授权项目'}</small></span><button aria-label={`移除${name}授权`} onClick={()=>setSelected(selected.filter(value=>value!==name))}>×</button></li>)}</ul>:<Empty>尚未选择项目</Empty>}</aside></div>
   {!selected.length&&<div className="config-small-note">当前未选择项目，保存后该角色无项目数据权限。</div>}
   <div className="config-footer"><span>{dirty?<Tag tone="orange">未保存</Tag>:<span className="muted">已配置 {selected.length} 个项目</span>}</span><div><Button disabled={!dirty} onClick={()=>setSelected([...saved])}>撤销修改</Button><Button primary onClick={save}>保存数据权限</Button></div></div>
  </section></div><p className="config-review-note">评审待确认：角色授权与现有个人授权的合并关系及优先级。</p>
  {nextRole&&<Modal title="项目数据权限尚未保存" width={460} onClose={()=>setNextRole(null)} footer={<><Button onClick={()=>setNextRole(null)}>继续编辑</Button><Button onClick={()=>activate(nextRole)}>放弃修改并切换</Button><Button primary onClick={()=>{save();activate(nextRole)}}>保存并切换</Button></>}><p>当前角色「{role}」的项目选择有未保存修改。</p></Modal>}
 </div>;
}

function ReminderPreview({rule,people,compact=false}) {
 const scope=rule.scope?.length?rule.scope.join('、'):'待选择范围';
 const names=rule.recipients?.length?rule.recipients.join('、'):'待选择接收人';
 const project=rule.scopeType==='项目'?(rule.scope?.[0]||'常州国贤府'):(projects.find(p=>rule.scope?.includes(p.city))?.name||'常州国贤府');
 return <div className={`config-reminder-preview ${compact?'compact':''}`}><div className="config-preview-label"><Tag tone="orange">待阅</Tag><span>内容预览</span></div><h4>整改即将到期 · {project}</h4><p>您关注的问题 P001 将于 2026-11-17 到期，请及时查看整改进展。</p><dl><div><dt>项目名称</dt><dd>{project}</dd></div><div><dt>整改期限</dt><dd>2026-11-17</dd></div><div><dt>提前提醒</dt><dd>{rule.days||'—'} 天</dd></div>{!compact&&<><div><dt>配置范围</dt><dd>{rule.scopeType} · {scope}</dd></div><div><dt>接收人员</dt><dd>{names}</dd></div></>}</dl><span className="config-preview-link">查看问题 →</span><small>示例待阅预览，保存规则不会发送真实通知。</small></div>;
}

export function Reminders({state,update,notify}) {
 const [query,setQuery]=useState('');
 const [keyword,setKeyword]=useState('');
 const [status,setStatus]=useState('all');
 const [editor,setEditor]=useState(null);
 const [errors,setErrors]=useState({});
 const [preview,setPreview]=useState(null);
 const [pendingDelete,setPendingDelete]=useState(null);
 const filtered=state.reminders.filter(rule=>rule.name.includes(keyword)&&(status==='all'||rule.enabled===(status==='enabled')));
 const openEditor=rule=>{setEditor(rule?{...rule,scope:[...rule.scope],recipients:[...rule.recipients]}:{id:null,name:'',scopeType:'城市公司',scope:[],days:3,recipients:[],enabled:true});setErrors({})};
 const edit=(key,value)=>{setEditor(current=>({...current,[key]:value}));setErrors(current=>({...current,[key]:undefined}))};
 const validate=()=>{
  const next={};
  if(!editor.name.trim())next.name='请填写规则名称';
  else if(state.reminders.some(rule=>rule.id!==editor.id&&rule.name===editor.name.trim()))next.name='规则名称已存在';
  if(!editor.scope.length)next.scope='请至少选择一个范围';
  if(!Number.isInteger(Number(editor.days))||Number(editor.days)<=0)next.days='请输入大于 0 的整数天数';
  if(!editor.recipients.length)next.recipients='请至少选择一位接收人';
  setErrors(next);return !Object.keys(next).length;
 };
 const save=()=>{
  if(!validate()){notify('请补充完整的预警规则');return;}
  const next={...editor,id:editor.id||uid('reminder'),name:editor.name.trim(),days:Number(editor.days)};
  update(draft=>{const index=draft.reminders.findIndex(rule=>rule.id===next.id);if(index===-1)draft.reminders.push(next);else draft.reminders[index]=next});setEditor(null);notify('到期预警规则已保存');
 };
 return <div className="config-page"><Notice>在整改到期前 X 天向所选人员生成“待阅”提醒，通知内容关联问题详情。待阅提醒不作为新的待办任务。</Notice><section className="config-card"><form className="config-toolbar" onSubmit={e=>{e.preventDefault();setKeyword(query.trim())}}><label>规则名称<input aria-label="查询预警规则" placeholder="请输入规则名称" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>启用状态<select aria-label="筛选规则状态" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">全部</option><option value="enabled">已启用</option><option value="disabled">已停用</option></select></label><Button type="submit" primary>查询</Button><Button type="button" onClick={()=>{setQuery('');setKeyword('');setStatus('all')}}>重置</Button><Button className="config-toolbar-end" type="button" primary onClick={()=>openEditor(null)}>＋ 新增规则</Button></form>
  <div className="config-table-wrap"><table className="config-table"><thead><tr><th>规则名称</th><th>范围</th><th>到期前天数</th><th>接收人</th><th>启用状态</th><th className="config-operations">操作</th></tr></thead><tbody>{filtered.map(rule=><tr key={rule.id}><td>{rule.name}<small className="config-cell-sub">通知方式：待阅</small></td><td><Tag tone="gray">{rule.scopeType}</Tag><span className="config-scope-cell">{rule.scope.join('、')}</span></td><td><span className="config-blue">{rule.days}</span> 天</td><td>{rule.recipients.join('、')}</td><td><button className={`config-switch ${rule.enabled?'on':''}`} role="switch" aria-checked={rule.enabled} aria-label={`${rule.enabled?'停用':'启用'}${rule.name}`} onClick={()=>{update(draft=>{draft.reminders.find(item=>item.id===rule.id).enabled=!rule.enabled});notify(rule.enabled?'规则已停用':'规则已启用')}}><span/></button><small className="config-switch-label">{rule.enabled?'已启用':'已停用'}</small></td><td><div className="config-row-actions"><button onClick={()=>openEditor(rule)}>编辑</button><button onClick={()=>setPreview(rule)}>预览</button><button className="config-text-danger" onClick={()=>setPendingDelete(rule)}>删除</button></div></td></tr>)}</tbody></table>{!filtered.length&&<Empty>暂无符合条件的预警规则</Empty>}</div><Pagination count={filtered.length}/></section><p className="config-review-note">评审待确认：同一问题命中多条规则时的优先级、去重及执行时间。</p>
  {editor&&<Modal title={`${editor.id?'编辑':'新增'}到期预警规则`} width={900} onClose={()=>setEditor(null)} footer={<><span className="config-modal-footnote">通知方式固定为待阅</span><Button onClick={()=>setEditor(null)}>取消</Button><Button primary onClick={save}>保存规则</Button></>}><div className="config-rule-editor"><div className="config-form"><Field label="规则名称" required><input autoFocus value={editor.name} maxLength={50} placeholder="例如：华东公司整改到期提醒" onChange={e=>edit('name',e.target.value)}/>{errors.name&&<small className="config-error" role="alert">{errors.name}</small>}</Field><Field label="范围类型" required><div className="config-radio-group">{['城市公司','项目'].map(value=><label key={value}><input name="scope-type" type="radio" value={value} checked={editor.scopeType===value} onChange={()=>{setEditor({...editor,scopeType:value,scope:[]});setErrors({...errors,scope:undefined})}}/>{value}</label>)}</div></Field><Field label={`选择${editor.scopeType}`} required><div className="config-check-list">{(editor.scopeType==='城市公司'?[...new Set(projects.map(p=>p.city))]:projects.map(p=>p.name)).map(value=><label key={value}><input type="checkbox" checked={editor.scope.includes(value)} onChange={()=>edit('scope',toggleValue(editor.scope,value))}/><span>{value}</span></label>)}</div>{errors.scope&&<small className="config-error" role="alert">{errors.scope}</small>}</Field><Field label="到期前天数" required help="距问题整改期限的提前天数，填写正整数。"><div className="config-number-unit"><input aria-label="到期前天数" type="number" min="1" step="1" value={editor.days} onChange={e=>edit('days',e.target.value)}/><span>天</span></div>{errors.days&&<small className="config-error" role="alert">{errors.days}</small>}</Field><Field label="接收人员" required><div className="config-check-list config-people-checks">{[...new Set(state.people.map(person=>person.name))].map(value=><label key={value}><input type="checkbox" checked={editor.recipients.includes(value)} onChange={()=>edit('recipients',toggleValue(editor.recipients,value))}/>{value}</label>)}</div>{errors.recipients&&<small className="config-error" role="alert">{errors.recipients}</small>}</Field><Field label="启用状态"><label className="config-inline-checkbox"><input type="checkbox" checked={editor.enabled} onChange={e=>edit('enabled',e.target.checked)}/>保存后启用</label></Field></div><ReminderPreview rule={editor} people={state.people}/></div></Modal>}
  {preview&&<Modal title="预警待阅内容预览" width={580} onClose={()=>setPreview(null)} footer={<Button primary onClick={()=>setPreview(null)}>关闭预览</Button>}><ReminderPreview rule={preview} people={state.people}/></Modal>}
  {pendingDelete&&<Modal title="删除预警规则" width={460} onClose={()=>setPendingDelete(null)} footer={<><Button onClick={()=>setPendingDelete(null)}>取消</Button><Button danger onClick={()=>{update(draft=>{draft.reminders=draft.reminders.filter(rule=>rule.id!==pendingDelete.id)});setPendingDelete(null);notify('预警规则已删除')}}>确认删除</Button></>}><p>确认删除「{pendingDelete.name}」？删除后不再按此规则生成提醒。</p></Modal>}
 </div>;
}

export function ReminderInbox({state,notify}) {
 const [view,setView]=useState('list');
 const [read,setRead]=useState(false);
 const [issueOpen,setIssueOpen]=useState(false);
 const problem=state.problems.find(p=>p.id==='P001')||state.problems[0];
 const leaf=allLeaves(state).find(item=>item.id===problem?.leafId);
 const recipient=state.people.find(person=>person.id===problem?.author)?.name||'陈工';
 const date='2026-11-17';
 const open=()=>{setView('detail');setRead(true)};
 return <div className="config-page"><Notice>以下为预警待阅示例，仅演示整改提醒与问题详情的查看流程。</Notice>{view==='list'?<section className="config-card"><SectionTitle aside={<Tag tone={read?'gray':'orange'}>{read?'已读 1 条':'未读 1 条'}</Tag>}>预警待阅</SectionTitle><div className="config-inbox-item"><div className="config-warning-icon">!</div><div className="config-inbox-content"><div className="config-inbox-title"><button onClick={open}>整改即将到期 · 常州国贤府</button>{!read&&<i aria-label="未读"/>}<Tag tone="orange">到期预警</Tag></div><p>问题 P001 将于 2026-11-17 到期，距示例提醒日期剩余 3 天，请关注整改进展。</p><span>2026-11-14 09:00 · 来源：到期预警规则 · 通知方式：待阅</span></div><Button small onClick={open}>查看详情</Button></div><Pagination count={1}/></section>:<section className="config-card config-inbox-detail"><div className="config-back-row"><button onClick={()=>setView('list')}>← 返回待阅列表</button><Tag tone="gray">已读</Tag></div><div className="config-detail-title"><div className="config-warning-icon">!</div><div><h2>整改即将到期</h2><p>常州国贤府 · 问题 P001</p></div><Tag tone="orange">剩余 3 天</Tag></div><div className="config-deadline-banner"><span>整改期限</span><strong>{date}</strong><span>请关注整改进展，及时完成问题整改。</span></div><dl className="config-detail-grid"><div><dt>项目名称</dt><dd>常州国贤府</dd></div><div><dt>问题编号</dt><dd>P001</dd></div><div><dt>所属检查项</dt><dd>{leaf?.path||'设计品质 / 景观设计 / 场地空间与动线'}</dd></div><div><dt>整改负责人</dt><dd>{recipient}</dd></div><div className="config-detail-wide"><dt>问题描述</dt><dd>{problem?.description||'展示区入口人行动线与车行动线交叉，导向标识不够清晰。'}</dd></div><div><dt>提醒时间</dt><dd>2026-11-14 09:00</dd></div><div><dt>提醒方式</dt><dd>待阅</dd></div></dl><div className="config-detail-actions"><Button primary onClick={()=>setIssueOpen(true)}>查看问题</Button><Button onClick={()=>{notify('本条待阅已标记为已读');setRead(true);setView('list')}}>已阅，返回列表</Button></div><p className="config-review-note">剩余天数按 2026-11-14 的示例提醒日期计算。</p></section>}
  {issueOpen&&<Modal title="问题详情 · P001" width={720} onClose={()=>setIssueOpen(false)} footer={<Button primary onClick={()=>setIssueOpen(false)}>关闭</Button>}><div className="config-issue-heading"><Tag tone="orange">待整改</Tag><span>常州国贤府</span></div><dl className="config-detail-grid"><div className="config-detail-wide"><dt>所属检查项</dt><dd>{leaf?.path||'设计品质 / 景观设计 / 场地空间与动线'}</dd></div><div className="config-detail-wide"><dt>问题描述</dt><dd>{problem?.description||'展示区入口人行动线与车行动线交叉，导向标识不够清晰。'}</dd></div><div><dt>登记人</dt><dd>{recipient}</dd></div><div><dt>整改负责人</dt><dd>{recipient}</dd></div><div><dt>整改期限</dt><dd>{date}</dd></div><div><dt>扣分值</dt><dd>{problem?.deduction??3} 分</dd></div><div className="config-detail-wide"><dt>现场图片</dt><dd>{problem?.images?.length?<div className="config-issue-images">{problem.images.map((src,index)=><img key={index} src={src} alt={`问题现场图片${index+1}`}/>)}</div>:<span className="muted">暂无现场图片</span>}</dd></div></dl><Notice>此处为问题只读详情；整改操作沿用现有问题处理流程。</Notice></Modal>}
 </div>;
}
