import test from 'node:test';
import assert from 'node:assert/strict';
import {leafScore, weightedScore, gradeFor, validateWeights} from '../src/domain.ts';
test('two problems deduct 3 points each from a 100 point leaf',()=>assert.equal(leafScore([3,3]),94));
test('third level scores aggregate into second level by weight',()=>assert.equal(weightedScore([94,100],[40,60]),97.6));
test('second level scores aggregate into first level by weight',()=>assert.equal(weightedScore([95,90],[40,60]),92));
test('matrix validates each dimension column, not each profession row',()=>{
 assert.deepEqual(validateWeights([[30,15],[15,30],[25,25],[10,10],[10,10],[10,10]]),[]);
 assert.deepEqual(validateWeights([[30,15],[15,30],[25,25],[10,10],[10,10],[5,10]]),[0]);
});
test('grade boundaries are lower inclusive and upper exclusive',()=>{
 for(const [score,expected] of [[95,'A+'],[94.99,'A'],[90,'A'],[89.99,'B+'],[85,'B+'],[80,'B'],[75,'B−'],[70,'C'],[69.99,'D']]) assert.equal(gradeFor(score),expected);
});
test('grade lookup uses configured ranges and keeps gaps visible',()=>{
 assert.equal(gradeFor(88,[{label:'良好',min:80,max:90}]),'良好');
 assert.equal(gradeFor(92,[{label:'良好',min:80,max:90}]),'未配置');
});
