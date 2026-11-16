const normalColumns = state => state.dimensions.filter(item => item.kind === 'normal').map(({id,name,weight}) => ({id,name,weight}));
export const templateSignature = state => JSON.stringify({dimensions:state.dimensions,professionals:state.professionals});

export function createTemplateDraft(state, isNew = false) {
 const columns = normalColumns(state);
 return structuredClone({
  templateName:isNew?'':state.templateName,
  nodeType:isNew?'':state.nodeType,
  nodeFrequency:isNew?'单次':(state.nodeFrequency??'单次'),
  frequencyCount:isNew?1:(state.frequencyCount??1),
  frequencyUnit:isNew?'月':(state.frequencyUnit??'月'),
  addressRequired:isNew?false:(state.addressRequired??false),
  templateStatus:isNew?'草稿':state.templateStatus,
  professionals:state.professionals,
  dimensions:isNew?[]:state.dimensions,
  matrix:isNew?[]:state.matrix,
  matrixGenerated:isNew?false:(state.matrixGenerated??state.matrix.length>0),
  matrixDimensionIds:isNew?[]:(state.matrixDimensionIds??columns.map(item=>item.id)),
  matrixProfessionals:isNew?[]:(state.matrixProfessionals??state.professionals),
  matrixColumns:isNew?[]:(state.matrixColumns??columns),
  matrixSource:isNew?'':(state.matrixSource??templateSignature(state)),
 });
}

export const weightTotal = items => Math.round(items.reduce((sum,item)=>sum+(Number(item.weight)||0),0)*10000)/10000;

export function templateIssues(state) {
 const issues=[];
 const add=(id,message)=>issues.push({id,message});
 const normal=state.dimensions.filter(item=>item.kind==='normal');
 if(!normal.length)add(null,'请至少添加一个普通一级检查项');
 if(normal.length&&Math.abs(weightTotal(normal)-100)>.0001)add(normal[0].id,`一级普通检查项权重合计 ${weightTotal(normal)}%，须为 100%`);
 state.dimensions.forEach(dim=>{
  if(!dim.name.trim())add(dim.id,'请填写一级检查项名称');
  if(!dim.groups.length)add(dim.id,`${dim.name||'一级检查项'}尚无二级检查项`);
  if(dim.kind==='normal'&&dim.groups.length&&Math.abs(weightTotal(dim.groups)-100)>.0001)add(dim.id,`${dim.name}的二级权重合计 ${weightTotal(dim.groups)}%，须为 100%`);
  dim.groups.forEach(group=>{
   if(!group.name.trim())add(group.id,'请填写二级检查项名称');
   if(!group.leaves.length)add(group.id,`${group.name||'二级检查项'}尚无三级检查项`);
   if(dim.kind==='normal'&&group.leaves.length&&Math.abs(weightTotal(group.leaves)-100)>.0001)add(group.id,`${group.name}的三级权重合计 ${weightTotal(group.leaves)}%，须为 100%`);
   group.leaves.forEach(leaf=>{
    if(!leaf.name.trim())add(leaf.id,'请填写三级检查项名称');
    if(!Number.isFinite(leaf.deduction)||leaf.deduction<0)add(leaf.id,`${leaf.name}须填写有效的非负分值`);
   });
  });
  if(dim.kind==='normal')[dim,...dim.groups,...dim.groups.flatMap(group=>group.leaves)].forEach(item=>{
   if(!Number.isFinite(item.weight)||item.weight<0||item.weight>100)add(item.id,`${item.name}的权重须在 0 至 100% 之间`);
  });
 });
 return issues;
}

export function itemReferences(state,id) {
 const dim=state.dimensions.find(item=>item.id===id);
 const group=state.dimensions.flatMap(item=>item.groups).find(item=>item.id===id);
 const ids=dim?dim.groups.flatMap(item=>item.leaves.map(leaf=>leaf.id)):group?group.leaves.map(leaf=>leaf.id):[id];
 return (state.problems||[]).filter(problem=>ids.includes(problem.leafId));
}

export function regenerateProfessionalWeights(state) {
 const columns=normalColumns(state);
 const previousIds=state.matrixDimensionIds??columns.map(item=>item.id);
 const previousProfessionals=state.matrixProfessionals??state.professionals;
 return {
  matrix:state.professionals.map(name=>columns.map(item=>{
   const row=previousProfessionals.indexOf(name),column=previousIds.indexOf(item.id);
   return row<0||column<0?0:(state.matrix[row]?.[column]??0);
  })),
  matrixDimensionIds:columns.map(item=>item.id),
  matrixProfessionals:[...state.professionals],
  matrixColumns:columns,
  matrixSource:templateSignature(state),
  matrixGenerated:true,
 };
}
