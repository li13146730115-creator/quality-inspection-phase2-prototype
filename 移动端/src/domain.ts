export type GradeRule = {label:string;min:number;max:number|null};
export type Leaf = {id:string;name:string;weight:number;deduction:number;descriptionRequired:boolean;imageRequired:boolean};
export type Group = {id:string;name:string;weight:number;leaves:Leaf[]};
export type Dimension = {id:string;name:string;weight:number;kind:'normal'|'bonus';groups:Group[]};
export type Problem = {id:string;leafId:string;description:string;images:string[];deduction:number;kind:'deduct'|'bonus';author:string;submitted:boolean};
export type Person = {id:string;name:string;professional:string;role:'评分人'|'拍照人';submitted:boolean};
export type Reminder = {id:string;name:string;scopeType:'城市公司'|'项目';scope:string[];days:number;recipients:string[];enabled:boolean};
export type InspectionState = {
 templateName:string;nodeType:string;professionals:string[];dimensions:Dimension[];matrix:number[][];
 problems:Problem[];people:Person[];completed:string[];review:number|null;reviewNote:string;reviewSavedAt:string;
 grades:GradeRule[];authorizedProjects:string[];reminders:Reminder[];nodeTypes:string[];templateStatus:string;
};
export const STORAGE_KEY='cland-inspection-phase2-1102-v1';
export const defaultGrades:GradeRule[]=[{label:'A+',min:95,max:null},{label:'A',min:90,max:95},{label:'B+',min:85,max:90},{label:'B',min:80,max:85},{label:'B−',min:75,max:80},{label:'C',min:70,max:75},{label:'D',min:-Infinity,max:70}];
export const projects=[{name:'常州国贤府',city:'华东公司',code:'CZ-GXF'},{name:'北京国贤府',city:'北京公司',code:'BJ-GXF'},{name:'苏州国贤府',city:'华东公司',code:'SZ-GXF'},{name:'南京国贤府',city:'华东公司',code:'NJ-GXF'}];
export const fmt=(n:number)=>Number.isFinite(n)?n.toFixed(2):'—';
export function leafScore(deductions:number[]) {return 100-deductions.reduce((a,b)=>a+b,0);}
export function weightedScore(values:number[],weights:number[]) {return values.reduce((sum,value,i)=>sum+value*(weights[i]??0)/100,0);}
export function gradeFor(score:number,rules:GradeRule[]=defaultGrades) {return rules.find(r=>score>=r.min&&(r.max===null||score<r.max))?.label??'未配置';}
export function validateWeights(matrix:number[][]):number[] {
 if(!matrix.length)return [];
 return matrix[0].map((_,i)=>i).filter(i=>matrix.some(row=>!Number.isFinite(row[i])||row[i]<0||row[i]>100)||Math.abs(matrix.reduce((s,row)=>s+row[i],0)-100)>0.00001);
}
function leaf(id:string,name:string,weight:number,deduction=3,imageRequired=true):Leaf {return {id,name,weight,deduction,descriptionRequired:true,imageRequired};}
export function createInitialState():InspectionState {
 return {
  templateName:'展示区开放巡检标准',nodeType:'展示区开放',professionals:['设计专业','工程专业','营销专业','客关专业','运营专业','物业专业'],
  dimensions:[
   {id:'design',name:'设计品质',weight:35,kind:'normal',groups:[{id:'landscape',name:'景观设计',weight:40,leaves:[leaf('design-1','场地空间与动线',40),leaf('design-2','景观细节与品质',60)]},{id:'interior',name:'室内设计',weight:60,leaves:[leaf('design-3','展示空间与尺度',50),leaf('design-4','材料与色彩搭配',50)]}]},
   {id:'build',name:'施工品质',weight:35,kind:'normal',groups:[{id:'facade',name:'外立面工程',weight:40,leaves:[leaf('build-1','外墙饰面观感',50),leaf('build-2','门窗安装与收口',50)]},{id:'detail',name:'精装工程',weight:60,leaves:[leaf('build-3','墙地面铺贴',60),leaf('build-4','设备安装与成品保护',40,5)]}]},
   {id:'marketing',name:'营销服务',weight:20,kind:'normal',groups:[{id:'service',name:'服务体验',weight:100,leaves:[leaf('market-1','现场接待与服务',60,3,false),leaf('market-2','展示资料与承诺',40,3,false)]}]},
   {id:'property',name:'物业服务',weight:10,kind:'normal',groups:[{id:'operation',name:'现场运维',weight:100,leaves:[leaf('property-1','环境维护与保洁',50),leaf('property-2','秩序管理与安全',50)]}]},
   {id:'bonus',name:'亮点加分',weight:0,kind:'bonus',groups:[{id:'innovation',name:'品质亮点',weight:100,leaves:[leaf('bonus-1','创新实践与品质提升',100,1,false)]}]}
  ],
  matrix:[[30,15,20,10],[15,30,10,10],[25,25,30,30],[10,10,20,10],[10,10,10,10],[10,10,10,30]],
  problems:[
   {id:'P001',leafId:'design-1',description:'展示区入口人行动线与车行动线交叉，导向标识不够清晰。',images:[],deduction:3,kind:'deduct',author:'p1',submitted:false},
   {id:'P002',leafId:'design-2',description:'景观铺装转角收边不顺直，局部材质衔接有高差。',images:[],deduction:3,kind:'deduct',author:'p2',submitted:true},
   {id:'P003',leafId:'build-1',description:'主入口外墙饰面存在局部色差，需对照样板整改。',images:[],deduction:3,kind:'deduct',author:'p3',submitted:true}
  ],
  people:[{id:'p1',name:'陈工',professional:'设计专业',role:'评分人',submitted:false},{id:'p2',name:'王工',professional:'设计专业',role:'拍照人',submitted:true},{id:'p3',name:'张工',professional:'工程专业',role:'评分人',submitted:true},{id:'p4',name:'李工',professional:'营销专业',role:'评分人',submitted:true},{id:'p5',name:'赵工',professional:'客关专业',role:'评分人',submitted:true},{id:'p6',name:'周工',professional:'运营专业',role:'评分人',submitted:true},{id:'p7',name:'刘工',professional:'物业专业',role:'评分人',submitted:true}],
  completed:['工程专业','营销专业','客关专业','运营专业','物业专业'],review:null,reviewNote:'',reviewSavedAt:'',grades:structuredClone(defaultGrades),authorizedProjects:['常州国贤府','北京国贤府','苏州国贤府'],
  reminders:[{id:'r1',name:'常州国贤府整改到期提醒',scopeType:'项目',scope:['常州国贤府'],days:3,recipients:['陈工','王工'],enabled:true}],nodeTypes:['展示区开放','运营交付','实体样板','销售期展示区品质'],templateStatus:'草稿'
 };
}
export function allLeaves(state:InspectionState) {return state.dimensions.flatMap(d=>d.groups.flatMap(g=>g.leaves.map(l=>({...l,dimensionId:d.id,dimensionName:d.name,groupName:g.name,kind:d.kind,path:`${d.name} / ${g.name} / ${l.name}`}))));}
export function calculate(state:InspectionState) {
 const dimensions=state.dimensions.filter(d=>d.kind==='normal');
 const professionalScores=state.professionals.map(prof=>dimensions.map(d=>{
  const authors=state.people.filter(p=>p.professional===prof).map(p=>p.id);
  const groups=d.groups.map(g=>weightedScore(g.leaves.map(l=>leafScore(state.problems.filter(p=>p.leafId===l.id&&authors.includes(p.author)&&p.kind==='deduct').map(p=>p.deduction))),g.leaves.map(l=>l.weight)));
  return weightedScore(groups,d.groups.map(g=>g.weight));
 }));
 const dimensionScores=dimensions.map((_,j)=>weightedScore(professionalScores.map(row=>row[j]),state.matrix.map(row=>row[j]??0)));
 const base=weightedScore(dimensionScores,dimensions.map(d=>d.weight));
 const bonus=state.problems.filter(p=>p.kind==='bonus').reduce((s,p)=>s+p.deduction,0);
 return {professionalScores,dimensionScores,base,bonus,total:base+bonus,ready:state.professionals.every(p=>state.completed.includes(p))};
}
export function loadState():InspectionState {
 try {const raw=localStorage.getItem(STORAGE_KEY);if(raw){const state=JSON.parse(raw);state.grades=state.grades.map((g:GradeRule)=>({...g,min:g.min===null?-Infinity:g.min}));return state;}} catch { /* A corrupt demo state falls back to the original example. */ }
 return createInitialState();
}
export function saveState(state:InspectionState) {localStorage.setItem(STORAGE_KEY,JSON.stringify(state));window.dispatchEvent(new Event('inspection-state'));}
