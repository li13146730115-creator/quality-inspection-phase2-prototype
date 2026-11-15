import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState} from '../src/domain.ts';
import {createTemplateDraft,regenerateProfessionalWeights} from '../src/template-config.js';

test('new template starts empty and leaves the existing template unchanged',()=>{
 const original=createInitialState();
 const draft=createTemplateDraft(original,true);
 assert.equal(draft.templateName,'');
 assert.deepEqual(draft.dimensions,[]);
 assert.deepEqual(draft.matrix,[]);
 assert.equal(draft.matrixGenerated,false);
 draft.professionals.push('新增专业');
 assert.equal(original.professionals.length,6);
 assert.equal(original.dimensions.length,5);
});

test('regeneration matches dimensions by ID and professionals by name after reorder and rename',()=>{
 const draft=createTemplateDraft(createInitialState());
 draft.dimensions[0].name='设计品质（调整）';
 draft.dimensions=[draft.dimensions[1],draft.dimensions[0],...draft.dimensions.slice(2)];
 draft.professionals=['工程专业','设计专业','新增专业'];
 const generated=regenerateProfessionalWeights(draft);
 assert.deepEqual(generated.matrixDimensionIds,['build','design','marketing','property']);
 assert.deepEqual(generated.matrix,[[30,15,10,10],[15,30,20,10],[0,0,0,0]]);
 assert.equal(generated.matrixColumns[1].name,'设计品质（调整）');
});

test('regeneration removes bonus columns and reads new ordinary items and latest child configuration',()=>{
 const draft=createTemplateDraft(createInitialState());
 draft.dimensions[0].kind='bonus';
 draft.dimensions[4].kind='normal';
 draft.dimensions.push({id:'new',name:'新增普通项',weight:0,kind:'normal',groups:[]});
 draft.dimensions[1].groups[0].leaves[0].deduction=8;
 const generated=regenerateProfessionalWeights(draft);
 assert.deepEqual(generated.matrixDimensionIds,['build','marketing','property','bonus','new']);
 assert.deepEqual(generated.matrix[0],[15,20,10,0,0]);
 assert.equal(generated.matrixGenerated,true);
 assert.match(generated.matrixSource,/"deduction":8/);
 assert.equal(draft.matrix[0][0],30);
});
