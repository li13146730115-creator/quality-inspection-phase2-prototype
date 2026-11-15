const normalColumns = state => state.dimensions.filter(item => item.kind === 'normal').map(({id,name,weight}) => ({id,name,weight}));
export const templateSignature = state => JSON.stringify({dimensions:state.dimensions,professionals:state.professionals});

export function createTemplateDraft(state, isNew = false) {
 const columns = normalColumns(state);
 return structuredClone({
  templateName:isNew?'':state.templateName,
  nodeType:isNew?'':state.nodeType,
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
