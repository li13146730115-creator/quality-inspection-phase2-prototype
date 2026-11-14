import {appBase,mobileUrl} from './paths';
import React, {useEffect, useMemo, useState} from 'react';
import {Button, Tag, Field, Notice, SectionTitle, Modal, Empty, Pagination} from './ui';
import {projects, calculate, fmt, gradeFor} from './domain';
import './business.css';

const uid=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
const today='2026-11-14';
const toggle=(values,value)=>values.includes(value)?values.filter(v=>v!==value):[...values,value];
const authorized=state=>projects.filter(project=>state.authorizedProjects.includes(project.name));
const enabledNodeTypes=state=>state.nodeTypes.filter(value=>state.dictionaryStatuses?.nodeTypes?.[value]!==false);

function TemplateSummary({template}) {
 const normal=template.dimensions.filter(item=>item.kind==='normal');
 return <><dl className="business-detail-grid"><div><dt>模板名称</dt><dd>{template.name||template.templateName}</dd></div><div><dt>巡检节点类型</dt><dd>{template.nodeType}</dd></div><div><dt>评分类型</dt><dd>分值制</dd></div><div><dt>专业条线</dt><dd>{template.professionals.join('、')}</dd></div></dl><div className="business-table-wrap"><table className="business-table"><thead><tr><th>一级检查项</th><th>检查项类型</th><th>一级权重</th><th>二级项数量</th></tr></thead><tbody>{template.dimensions.map(item=><tr key={item.id}><td>{item.name}</td><td><Tag tone={item.kind==='normal'?'blue':'orange'}>{item.kind==='normal'?'普通项':'加分项'}</Tag></td><td>{item.kind==='normal'?`${item.weight}%`:'不配置权重'}</td><td>{item.groups.length}</td></tr>)}</tbody></table></div><h4 className="business-mini-title">专业条线权重矩阵</h4><div className="business-table-wrap"><table className="business-table"><thead><tr><th>专业</th>{normal.map(item=><th key={item.id}>{item.name}</th>)}</tr></thead><tbody>{template.professionals.map((name,i)=><tr key={name}><td>{name}</td>{normal.map((item,j)=><td key={item.id}>{template.matrix[i]?.[j]??0}%</td>)}</tr>)}</tbody></table></div></>;
}

export function Templates({state,update,notify,go}) {
 const [query,setQuery]=useState('');
 const [filters,setFilters]=useState({name:'',mode:'all'});
 const [mode,setMode]=useState('all');
 const [create,setCreate]=useState(false);
 const [form,setForm]=useState({name:'',nodeType:enabledNodeTypes(state)[0]||''});
 const [error,setError]=useState('');
 const [detail,setDetail]=useState(null);
 const current={id:'current',name:state.templateName,nodeType:state.nodeType,status:state.templateStatus,mode:'score',operator:'陈工',date:today,current:true,...{professionals:state.professionals,dimensions:state.dimensions,matrix:state.matrix}};
 const historical={id:'legacy',name:'展示区开放巡检标准（历史等级制）',nodeType:'展示区开放',status:'历史归档',mode:'legacy',operator:'系统管理员',date:'2026-06-30'};
 const rows=[current,...(state.savedTemplates||[]).map(t=>({...t,current:false,mode:'score'})),historical].filter(row=>row.name.includes(filters.name)&&(filters.mode==='all'||row.mode===filters.mode));
 const saveNew=()=>{
  const name=form.name.trim();
  if(!name){setError('请输入模板名称');return;}
  if([state.templateName,...(state.savedTemplates||[]).map(t=>t.name)].includes(name)){setError('模板名称已存在');return;}
  if(!enabledNodeTypes(state).includes(form.nodeType)){setError('请选择已启用的巡检节点类型');return;}
  update(draft=>{
   draft.savedTemplates??=[];
   draft.savedTemplates.push({...structuredClone(current),id:uid('template'),current:false});
   draft.templateName=name;draft.nodeType=form.nodeType;draft.templateStatus='草稿';
  });setCreate(false);notify('分值制模板草稿已创建，请继续检查配置后启用');go('template');
 };
 return <div className="business-page"><Notice>新增模板统一采用分值制，按检查项与专业权重自动计分。历史等级制模板保留只读查看。</Notice><section className="business-card"><form className="business-toolbar" onSubmit={event=>{event.preventDefault();setFilters({name:query.trim(),mode})}}><label>模板名称<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="请输入模板名称"/></label><label>评分类型<select value={mode} onChange={e=>setMode(e.target.value)}><option value="all">全部</option><option value="score">分值制</option><option value="legacy">等级制（历史）</option></select></label><Button primary type="submit">查询</Button><Button type="button" onClick={()=>{setQuery('');setMode('all');setFilters({name:'',mode:'all'})}}>重置</Button><Button primary type="button" className="business-toolbar-end" onClick={()=>{setCreate(true);setForm({name:'',nodeType:enabledNodeTypes(state)[0]||''});setError('')}}>＋ 新增分值制模板</Button></form><div className="business-table-wrap"><table className="business-table"><thead><tr><th>模板名称</th><th>巡检节点类型</th><th>评分类型</th><th>状态</th><th>操作人</th><th>操作时间</th><th>操作</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><button className="business-link" onClick={()=>row.current?go('template'):setDetail(row)}>{row.name}</button></td><td>{row.nodeType}</td><td><Tag tone={row.mode==='legacy'?'gray':'blue'}>{row.mode==='legacy'?'等级制（历史）':'分值制'}</Tag></td><td><Tag tone={row.status==='已启用'?'green':row.status==='历史归档'?'gray':'orange'}>{row.status}</Tag></td><td>{row.operator||'陈工'}</td><td>{row.date||today}</td><td><div className="business-row-actions">{row.current?<><button onClick={()=>go('template')}>编辑</button><button onClick={()=>go('template')}>专业权重</button></>:<button onClick={()=>setDetail(row)}>只读查看</button>}</div></td></tr>)}</tbody></table>{!rows.length&&<Empty/>}</div><Pagination count={rows.length}/></section>
  {create&&<Modal title="新增分值制模板" width={540} onClose={()=>setCreate(false)} footer={<><Button onClick={()=>setCreate(false)}>取消</Button><Button primary onClick={saveNew}>创建并配置</Button></>}><div className="business-form"><Notice>基于当前模板复制检查结构与专业权重，新模板保存为草稿。原模板配置保留为只读快照。</Notice><Field label="模板名称" required><input autoFocus value={form.name} maxLength={50} placeholder="请输入模板名称" onChange={e=>{setForm({...form,name:e.target.value});setError('')}}/></Field><Field label="巡检节点类型" required><select value={form.nodeType} onChange={e=>setForm({...form,nodeType:e.target.value})}><option value="">请选择</option>{enabledNodeTypes(state).map(value=><option key={value}>{value}</option>)}</select></Field><Field label="评分类型"><Tag>分值制</Tag></Field>{error&&<div className="business-error" role="alert">{error}</div>}</div></Modal>}
  {detail&&<Modal title={detail.mode==='legacy'?'历史等级制模板 · 只读':'模板配置快照 · 只读'} width={920} onClose={()=>setDetail(null)} footer={<Button primary onClick={()=>setDetail(null)}>关闭</Button>}>{detail.mode==='legacy'?<><Notice>历史模板仅保留当时的等级标准与引用信息，不按新分值公式重算。</Notice><dl className="business-detail-grid"><div><dt>模板名称</dt><dd>{detail.name}</dd></div><div><dt>评分类型</dt><dd>等级制（历史）</dd></div><div><dt>适用节点类型</dt><dd>{detail.nodeType}</dd></div><div><dt>归档日期</dt><dd>{detail.date}</dd></div></dl><div className="business-table-wrap"><table className="business-table"><thead><tr><th>检查项</th><th>历史评分方式</th><th>历史记录</th></tr></thead><tbody><tr><td>展示区景观</td><td>人工等级评定</td><td>A</td></tr><tr><td>展示区建筑</td><td>人工等级评定</td><td>B+</td></tr></tbody></table></div></>:<TemplateSummary template={detail}/>}</Modal>}
 </div>;
}

function initialRecords(kind,state) {
 const type=kind==='nodes'?'节点':kind==='plans'?'计划':'任务';
 return projects.slice(0,3).map((project,index)=>({id:`${kind}-demo-${index}`,name:`${project.name}11月品质巡检${type}`,project:project.name,city:project.city,nodeType:state.nodeType,templateName:state.templateName,date:index===0?'2026-11-14':index===1?'2026-11-18':'2026-11-20',status:kind==='nodes'?'已建库':kind==='plans'?'执行中':index===0?'巡检中':'未开始',owner:'陈工',example:index===0}));
}

export function BusinessList({state,update,notify,go,kind='plans'}) {
 const allowed=authorized(state);
 const allowedNames=allowed.map(p=>p.name);
 const [selected,setSelected]=useState(()=>[...state.authorizedProjects]);
 const [query,setQuery]=useState('');
 const [selectionOpen,setSelectionOpen]=useState(false);
 const [filters,setFilters]=useState(()=>({projects:[...state.authorizedProjects],name:''}));
 const [create,setCreate]=useState(false);
 const [form,setForm]=useState(null);
 const [errors,setErrors]=useState({});
 const [detail,setDetail]=useState(null);
 const label=kind==='nodes'?'项目节点':kind==='plans'?'巡检计划':'巡检任务';
 useEffect(()=>{setSelected([...state.authorizedProjects]);setFilters({projects:[...state.authorizedProjects],name:''});setQuery('')},[state.authorizedProjects.join('|'),kind]);
 const records=[...initialRecords(kind,state),...(state.businessRecords?.[kind]||[])];
 const rows=records.filter(row=>allowedNames.includes(row.project)&&filters.projects.includes(row.project)&&row.name.includes(filters.name));
 const results=calculate(state);
 const normal=state.dimensions.filter(d=>d.kind==='normal');
 const blank=()=>({name:'',project:allowedNames[0]||'',nodeType:enabledNodeTypes(state)[0]||'',templateName:state.templateName,date:today,owner:state.people[0]?.name||'陈工'});
 const save=()=>{
  const next={};
  if(!form.name.trim())next.name=`请输入${label}名称`;
  if(!allowedNames.includes(form.project))next.project='请选择有权限的项目';
  if(!enabledNodeTypes(state).includes(form.nodeType))next.nodeType='请选择已启用的节点类型';
  if(!form.templateName)next.templateName='请选择模板';
  if(!form.date)next.date='请选择巡检日期';
  if(!form.owner)next.owner='请选择负责人';
  setErrors(next);if(Object.keys(next).length)return;
  const project=projects.find(p=>p.name===form.project);
  update(draft=>{draft.businessRecords??={};draft.businessRecords[kind]??=[];draft.businessRecords[kind].push({...form,name:form.name.trim(),id:uid(kind),city:project.city,status:kind==='nodes'?'已建库':kind==='plans'?'待执行':'未开始',example:false})});setCreate(false);notify(`${label}已创建`);
 };
 const statusFor=row=>kind==='tasks'&&row.example?(results.ready?(state.reviewSavedAt?'评分已保存':'待运营评分'):'巡检中'):row.status;
 const templates=[state.templateName,...(state.savedTemplates||[]).map(item=>item.name)];
 const chosenTemplate=detail?.templateName===state.templateName?{...state,name:state.templateName}:state.savedTemplates?.find(t=>t.name===detail?.templateName);
 return <div className="business-page"><Notice>{kind==='plans'?'所属项目默认全部授权项目；查询、重置与新增均受项目数据权限限制。':kind==='nodes'?'项目节点关联分值制模板，专业列表、一级权重与专业矩阵随模板展示。':'专业完成全部巡检后进入运营评分；未完成条线不提前显示为 0 分。'}</Notice><section className="business-card"><form className="business-toolbar" onSubmit={e=>{e.preventDefault();setFilters({projects:selected.filter(name=>allowedNames.includes(name)),name:query.trim()});setSelectionOpen(false)}}><div className="business-project-filter"><span>所属项目</span><button type="button" className="business-select-button" aria-expanded={selectionOpen} onClick={()=>setSelectionOpen(!selectionOpen)}>{selected.filter(name=>allowedNames.includes(name)).length===allowedNames.length&&allowedNames.length>0?'全部授权项目':`已选择 ${selected.filter(name=>allowedNames.includes(name)).length} 个项目`}<span>⌄</span></button>{selectionOpen&&<div className="business-project-popover"><div className="business-project-popover-heading"><label><input type="checkbox" checked={allowedNames.length>0&&allowedNames.every(name=>selected.includes(name))} onChange={()=>setSelected(allowedNames.every(name=>selected.includes(name))?[]:[...allowedNames])}/>全部授权项目</label><button type="button" onClick={()=>setSelectionOpen(false)}>完成</button></div>{allowed.length?allowed.map(project=><label key={project.code}><input type="checkbox" checked={selected.includes(project.name)} onChange={()=>setSelected(toggle(selected,project.name))}/><span>{project.name}<small>{project.city}</small></span></label>):<Empty>暂无授权项目</Empty>}</div>}</div><label>{label}名称<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="请输入名称"/></label><Button primary type="submit">查询</Button><Button type="button" onClick={()=>{setSelected([...allowedNames]);setQuery('');setFilters({projects:[...allowedNames],name:''});setSelectionOpen(false)}}>重置</Button><Button type="button" primary disabled={!allowed.length} className="business-toolbar-end" onClick={()=>{setForm(blank());setErrors({});setCreate(true)}}>＋ 新增{label}</Button></form><div className="business-filter-summary">当前查询范围：{filters.projects.filter(name=>allowedNames.includes(name)).length===allowedNames.length&&allowedNames.length>0?'全部授权项目':`${filters.projects.filter(name=>allowedNames.includes(name)).length} 个项目`}<span>共 {allowed.length} 个授权项目</span></div><div className="business-table-wrap"><table className="business-table"><thead><tr><th>{label}名称</th><th>所属项目</th><th>巡检节点类型</th><th>关联模板</th><th>巡检日期</th><th>负责人</th><th>状态</th><th>操作</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><button className="business-link" onClick={()=>setDetail(row)}>{row.name}</button></td><td>{row.project}<small className="business-cell-sub">{row.city}</small></td><td>{row.nodeType}</td><td>{row.templateName}<small className="business-cell-sub">分值制</small></td><td>{row.date}</td><td>{row.owner}</td><td><Tag tone={statusFor(row)==='巡检中'?'orange':statusFor(row).includes('评分')?'blue':'gray'}>{statusFor(row)}</Tag></td><td><div className="business-row-actions"><button onClick={()=>setDetail(row)}>详情</button>{kind==='tasks'&&row.example&&<button onClick={()=>go('scoring')}>运营评分</button>}</div></td></tr>)}</tbody></table>{!rows.length&&<Empty>{allowed.length?'暂无符合查询条件的记录':'暂无授权项目，请联系权限管理员配置'}</Empty>}</div><Pagination count={rows.length}/></section>
  {create&&form&&<Modal title={`新增${label}`} width={640} onClose={()=>setCreate(false)} footer={<><Button onClick={()=>setCreate(false)}>取消</Button><Button primary onClick={save}>保存</Button></>}><div className="business-form"><Field label={`${label}名称`} required><input autoFocus value={form.name} onChange={e=>setForm({...form,name:e.target.value})} maxLength={60} placeholder="请输入名称"/>{errors.name&&<small className="business-error" role="alert">{errors.name}</small>}</Field><div className="business-form-grid"><Field label="所属项目" required><select value={form.project} onChange={e=>setForm({...form,project:e.target.value})}><option value="">请选择项目</option>{allowed.map(project=><option key={project.code}>{project.name}</option>)}</select>{errors.project&&<small className="business-error">{errors.project}</small>}</Field><Field label="巡检节点类型" required><select value={form.nodeType} onChange={e=>setForm({...form,nodeType:e.target.value})}><option value="">请选择节点类型</option>{enabledNodeTypes(state).map(value=><option key={value}>{value}</option>)}</select>{errors.nodeType&&<small className="business-error">{errors.nodeType}</small>}</Field></div><Field label="关联巡检模板" required><select value={form.templateName} onChange={e=>setForm({...form,templateName:e.target.value})}>{templates.map(name=><option key={name}>{name}</option>)}</select><small className="muted">仅提供分值制模板，模板检查项和专业权重随详情展示。</small>{errors.templateName&&<small className="business-error">{errors.templateName}</small>}</Field><div className="business-form-grid"><Field label="巡检日期" required><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/>{errors.date&&<small className="business-error">{errors.date}</small>}</Field><Field label="负责人" required><select value={form.owner} onChange={e=>setForm({...form,owner:e.target.value})}>{[...new Set(state.people.map(p=>p.name))].map(name=><option key={name}>{name}</option>)}</select>{errors.owner&&<small className="business-error">{errors.owner}</small>}</Field></div></div></Modal>}
  {detail&&<Modal title={`${label}详情`} width={980} onClose={()=>setDetail(null)} footer={<><Button onClick={()=>setDetail(null)}>关闭</Button>{kind==='tasks'&&detail.example&&<Button primary onClick={()=>{setDetail(null);go('scoring')}}>进入运营评分</Button>}</>}><dl className="business-detail-grid"><div><dt>{label}名称</dt><dd>{detail.name}</dd></div><div><dt>所属项目</dt><dd>{detail.project} / {detail.city}</dd></div><div><dt>巡检日期 / 负责人</dt><dd>{detail.date} / {detail.owner}</dd></div><div><dt>当前状态</dt><dd><Tag tone="blue">{statusFor(detail)}</Tag></dd></div></dl><SectionTitle>关联模板配置</SectionTitle>{chosenTemplate?<TemplateSummary template={chosenTemplate}/>:<Notice>关联模板：{detail.templateName} · 节点类型：{detail.nodeType}</Notice>}{kind==='tasks'&&<><h4 className="business-mini-title">巡检进展</h4><div className="business-profession-tags">{state.professionals.map(name=><Tag key={name} tone={detail.example&&state.completed.includes(name)?'green':'orange'}>{name} · {detail.example?(state.completed.includes(name)?'已完成':'未完成'):'未开始'}</Tag>)}</div>{!results.ready&&detail.example&&<Notice tone="warning">尚有 {state.professionals.filter(name=>!state.completed.includes(name)).join('、')} 未完成，暂不生成运营总分。</Notice>}</>}</Modal>}
 </div>;
}

function downloadCsv(filename,headers,rows) {
 const escape=value=>{let str=String(value??'');if(/^[=+@\-\t\r]/.test(str))str=`'${str}`;return `"${str.replaceAll('"','""')}"`};
 const blob=new Blob(['\uFEFF'+[headers,...rows].map(row=>row.map(escape).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
 const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;document.body.appendChild(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function Statistics({state,notify,go}) {
 const [tab,setTab]=useState('score');
 const [city,setCity]=useState('');
 const [project,setProject]=useState('');
 const [start,setStart]=useState('2026-11-01');
 const [end,setEnd]=useState('2026-11-30');
 const [type,setType]=useState('');
 const [filters,setFilters]=useState({city:'',project:'',start:'2026-11-01',end:'2026-11-30',type:''});
 const [error,setError]=useState('');
 const [detail,setDetail]=useState(null);
 const allowed=authorized(state);
 const result=calculate(state);
 const dimensions=state.dimensions.filter(d=>d.kind==='normal');
 const ready=result.ready;
 const reviewed=ready&&state.review!==null&&!!state.reviewSavedAt;
 const finalScore=reviewed?state.review:null;
 const sampleAllowed=state.authorizedProjects.includes('常州国贤府');
 const newRows=sampleAllowed?[{id:'current-report',project:'常州国贤府',city:'华东公司',date:today,type:state.nodeType}]:[];
 const oldRows=sampleAllowed?[{id:'legacy-report',project:'常州国贤府',city:'华东公司',date:'2026-06-30',type:'展示区开放',grade:'A',professional:'设计专业'}]:[];
 const rows=(tab==='score'?newRows:oldRows).filter(row=>(!filters.city||row.city===filters.city)&&(!filters.project||row.project===filters.project)&&(!filters.type||row.type===filters.type)&&(!filters.start||row.date>=filters.start)&&(!filters.end||row.date<=filters.end));
 const headers=tab==='score'?['项目','城市公司','巡检日期','节点类型',...dimensions.map(d=>`${d.name}得分`),'系统计算分','复核分','最终等级','评分状态']:['项目','城市公司','巡检日期','节点类型','专业','历史等级'];
 const values=rows.map(row=>tab==='score'?[row.project,row.city,row.date,row.type,...dimensions.map((_,i)=>ready?fmt(result.dimensionScores[i]):'未完成'),ready?fmt(result.total):'未完成',reviewed?fmt(finalScore):'待评分',reviewed?gradeFor(finalScore,state.grades):'待评分',reviewed?'评分已保存':ready?'待运营评分':'未完成']:[row.project,row.city,row.date,row.type,row.professional,row.grade]);
 const query=event=>{event.preventDefault();if(start&&end&&start>end){setError('开始日期不能晚于结束日期');return;}setError('');setFilters({city,project,start,end,type})};
 const switchTab=next=>{setTab(next);setStart(next==='legacy'?'2026-01-01':'2026-11-01');setEnd(next==='legacy'?'2026-10-31':'2026-11-30');setFilters({city:'',project:'',start:next==='legacy'?'2026-01-01':'2026-11-01',end:next==='legacy'?'2026-10-31':'2026-11-30',type:''});setCity('');setProject('');setType('');setError('')};
 return <div className="business-page"><div className="business-tabs" role="tablist" aria-label="统计报表类型"><button role="tab" aria-selected={tab==='score'} className={tab==='score'?'active':''} onClick={()=>switchTab('score')}>赋分制报表</button><button role="tab" aria-selected={tab==='legacy'} className={tab==='legacy'?'active':''} onClick={()=>switchTab('legacy')}>等级制报表（历史）</button></div><Notice tone={tab==='legacy'?'warning':'info'}>{tab==='legacy'?'历史等级保持原有结果，只读查看，不与新分值数据混合统计或重算。':'赋分制报表按模板动态展示一级项、系统分、复核分与最终等级。全部专业完成后生成汇总，运营保存复核分后呈现最终等级。'}</Notice><section className="business-card"><form className="business-toolbar business-stat-toolbar" onSubmit={query}><label>城市公司<select value={city} onChange={e=>{setCity(e.target.value);setProject('')}}><option value="">全部授权城市</option>{[...new Set(allowed.map(p=>p.city))].map(name=><option key={name}>{name}</option>)}</select></label><label>所属项目<select value={project} onChange={e=>setProject(e.target.value)}><option value="">全部授权项目</option>{allowed.filter(p=>!city||p.city===city).map(p=><option key={p.code}>{p.name}</option>)}</select></label><label>巡检日期<input aria-label="统计开始日期" type="date" value={start} onChange={e=>setStart(e.target.value)}/><span>至</span><input aria-label="统计结束日期" type="date" value={end} onChange={e=>setEnd(e.target.value)}/></label><label>节点类型<select value={type} onChange={e=>setType(e.target.value)}><option value="">全部类型</option>{state.nodeTypes.map(name=><option key={name}>{name}</option>)}</select></label><Button type="submit" primary>查询</Button><Button type="button" onClick={()=>switchTab(tab)}>重置</Button><Button type="button" className="business-toolbar-end" onClick={()=>{downloadCsv(`品质巡检-${tab==='score'?'赋分制':'历史等级制'}-${today}.csv`,headers,values);notify(`已导出当前查询结果，共 ${rows.length} 条`)}}>导出当前结果</Button></form>{error&&<p role="alert" className="business-error">{error}</p>}
  <div className="business-stat-cards"><div><span>当前查询记录</span><strong>{rows.length}<small> 条</small></strong></div><div><span>{tab==='score'?'已完成专业':'历史数据'}</span><strong>{tab==='score'?(rows.length?`${state.completed.filter(name=>state.professionals.includes(name)).length} / ${state.professionals.length}`:'—'):'只读'}<small>{tab==='score'?' 条线':''}</small></strong></div><div><span>{tab==='score'?'系统计算分':'历史最终等级'}</span><strong>{tab==='score'?(rows.length&&ready?fmt(result.total):'—'):(rows[0]?.grade||'—')}</strong></div><div><span>最终等级</span><strong>{tab==='score'?(rows.length&&reviewed?gradeFor(finalScore,state.grades):'待评分'):(rows[0]?.grade||'—')}</strong></div></div>
  <div className="business-table-wrap"><table className="business-table business-report-table"><thead><tr>{headers.map(name=><th key={name}>{name}</th>)}<th>操作</th></tr></thead><tbody>{rows.map((row,index)=><tr key={row.id}>{values[index].map((value,col)=><td key={col}>{value==='未完成'?<Tag tone="orange">未完成</Tag>:value==='待评分'?<span className="muted">待评分</span>:value}</td>)}<td><button className="business-link" onClick={()=>setDetail(row)}>查看明细</button></td></tr>)}</tbody></table>{!rows.length&&<Empty>当前权限与查询条件下暂无统计结果</Empty>}</div><Pagination count={rows.length}/>
  {tab==='score'&&rows.length>0&&<><SectionTitle aside={<Button small onClick={()=>go('scoring')}>进入任务评分</Button>}>专业维度得分</SectionTitle><div className="business-table-wrap"><table className="business-table"><thead><tr><th>专业条线</th>{dimensions.map(d=><th key={d.id}>{d.name}</th>)}<th>巡检状态</th></tr></thead><tbody>{state.professionals.map((professional,i)=><tr key={professional}><td>{professional}</td>{dimensions.map((d,j)=><td key={d.id}>{ready?fmt(result.professionalScores[i][j]):<Tag tone="orange">未完成</Tag>}</td>)}<td><Tag tone={state.completed.includes(professional)?'green':'orange'}>{state.completed.includes(professional)?'已完成':'未完成'}</Tag></td></tr>)}</tbody></table></div></>}
 </section>{detail&&<Modal title={tab==='score'?'赋分制巡检报告明细':'历史等级制报告 · 只读'} width={860} onClose={()=>setDetail(null)} footer={<><Button onClick={()=>setDetail(null)}>关闭</Button>{tab==='score'&&<Button primary onClick={()=>{setDetail(null);go('scoring')}}>查看计分来源</Button>}</>}><dl className="business-detail-grid"><div><dt>所属项目</dt><dd>{detail.project}</dd></div><div><dt>巡检日期</dt><dd>{detail.date}</dd></div><div><dt>评分模式</dt><dd>{tab==='score'?'分值制':'等级制（历史）'}</dd></div><div><dt>最终等级</dt><dd>{tab==='score'?(reviewed?gradeFor(finalScore,state.grades):'待评分'):detail.grade}</dd></div>{tab==='score'&&<><div><dt>系统计算分</dt><dd>{ready?fmt(result.total):'未完成'}</dd></div><div><dt>复核分</dt><dd>{reviewed?fmt(finalScore):'待评分'}</dd></div><div className="business-detail-wide"><dt>复核说明</dt><dd>{state.reviewNote||'暂无复核说明'}</dd></div></>}</dl>{tab==='score'?<><Notice tone={ready?'success':'warning'}>{ready?'全部专业已完成，系统计算分只读。最终等级由已保存的复核分映射。':`尚有 ${state.professionals.filter(name=>!state.completed.includes(name)).join('、')} 未完成，暂不生成汇总分。`}</Notice><h4 className="business-mini-title">问题明细</h4><div className="business-table-wrap"><table className="business-table"><thead><tr><th>问题编号</th><th>问题描述</th><th>登记人</th><th>扣 / 加分</th></tr></thead><tbody>{state.problems.map(problem=><tr key={problem.id}><td>{problem.id}</td><td>{problem.description}</td><td>{state.people.find(p=>p.id===problem.author)?.name||'—'}</td><td>{problem.kind==='bonus'?'+':'−'}{problem.deduction}</td></tr>)}</tbody></table></div></>:<Notice>本报告保留历史人工等级结论，不展示新制系统分与复核分。</Notice>}</Modal>}</div>;
}

const reviewItems=[
 {id:1,row:3,name:'移动端未提交问题可编辑',page:'M02 问题列表 / M03 问题编辑',nav:'mobile',action:'查看小程序',test:'编辑本人未提交问题，问题总数保持不变；已提交记录只读。'},
 {id:2,row:4,name:'节点类型、专业条线前端配置',page:'P09 参数字典 / P01 模板引用',nav:'dictionaries',action:'参数字典',test:'新增专业、补零矩阵行；被引用字典禁止删除，停用保留引用。'},
 {id:3,row:5,name:'末级描述与图片必填校验',page:'P02 末级配置 / M03 问题表单',nav:'template',action:'检查项配置',test:'末级项可配置描述、图片必填；移动登记按末级规则校验。'},
 {id:4,row:6,name:'基于角色授权项目数据',page:'P10 角色项目数据权限',nav:'permissions',action:'角色数据权限',test:'搜索并多选项目，保存后已选清单保留，计划范围同步授权。'},
 {id:5,row:7,name:'完成后进入运营评分，防漏保存',page:'P05 运营评分 / M05 条线完成',nav:'scoring',action:'运营评分',test:'未完成专业不计总分；复核分修改后显示未保存，离开有提醒。'},
 {id:6,row:8,name:'本人提交与条线完成汇总',page:'M04 本人提交 / M05 条线汇总',nav:'mobile',action:'查看小程序',test:'展示人员与检查项明细；条线弹窗滚动、汇总与未提交状态明确。'},
 {id:7,row:9,name:'计划默认全部项目',page:'P04 巡检计划',nav:'plans',action:'巡检计划',test:'首次进入与重置均恢复全部授权项目，无权限项目不可选。'},
 {id:8,row:10,name:'新制度计分及关联页面',page:'P01—P08 / M01—M05',nav:'template',action:'专业权重矩阵',test:'逐级加权，专业矩阵按列 100%；复核分自动映射最终等级。'},
 {id:9,row:11,name:'城市 / 项目到期前 X 天预警',page:'P11 预警规则 / P12 预警待阅',nav:'reminders',action:'到期预警规则',test:'城市 / 项目多选、正整数天数、接收人员与待阅内容可预览。'},
];
const openQuestions=[['加分归属','加分计入哪一级、在哪轮加权后累加，需业务确认。'],['分值精度与上下限','正式小数处理、负分及超过 100 分口径未明确。'],['历史与生效边界','规则生效时点、历史快照及存量未完成任务口径待确认。'],['角色与个人授权','项目数据权限的并集或优先级规则尚未明确。'],['条线完成门禁','原型按存在未提交人员时禁止完成演示，强制完成权限待确认。'],['预警规则命中','多条规则同时命中的优先级、去重和执行时间待确认。']];

export function ReviewGuide({go}) {
 return <div className="business-page"><Notice>评审依据：1102 需求清单“二期”工作表第 3—11 行，以及 2026-11-11 两段沟通录屏。本目录按 9 项需求定位页面与验收操作。</Notice><div className="business-guide-hero"><div><Tag>品质巡检系统 · 二期</Tag><h2>需求评审目录</h2><p>沿用原系统结构，重点评审自动计分、提交完成、项目授权与到期待阅。</p></div><div className="business-guide-count"><strong>9</strong><span>项需求 · 完整映射</span></div></div><section className="business-card"><SectionTitle>需求与页面对照</SectionTitle><div className="business-table-wrap"><table className="business-table business-guide-table"><thead><tr><th>清单序号</th><th>Excel 行</th><th>需求与页面</th><th>重点验收操作</th><th>评审入口</th></tr></thead><tbody>{reviewItems.map(item=><tr key={item.id}><td><span className="business-number-chip">{String(item.id).padStart(2,'0')}</span></td><td>第 {item.row} 行</td><td><strong>{item.name}</strong><small className="business-cell-sub">{item.page}</small></td><td>{item.test}</td><td><Button small onClick={()=>item.nav==='mobile'?window.open(mobileUrl,'_blank','noopener,noreferrer'):go(item.nav)}>{item.action} →</Button></td></tr>)}</tbody></table></div></section><div className="business-guide-bottom"><section className="business-card"><SectionTitle>关联页面快速入口</SectionTitle><div className="business-guide-links">{[['templates','模板库'],['nodes','项目节点库'],['tasks','巡检任务'],['reports','巡检报告'],['statistics','统计分析'],['grades','等级规则'],['inbox','预警待阅']].map(([nav,label])=><button key={nav} onClick={()=>go(nav)}>{label}<span>→</span></button>)}</div></section><section className="business-card"><SectionTitle>待确认规则</SectionTitle><ul className="business-question-list">{openQuestions.map(([name,detail])=><li key={name}><strong>{name}</strong><span>{detail}</span></li>)}</ul></section></div><p className="business-review-note">所有保存、授权、提交和预警均为原型内示例状态，不连接生产接口或发送真实通知。</p></div>;
}
