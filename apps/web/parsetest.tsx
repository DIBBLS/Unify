import { parseLatex, compileEquation } from './src/components/VisualEquation';
const cases = [
  '\\[ P = \\frac{a}{b} \\]',
  '\\[ x^{2} + y_{1} \\]',
  'T_{fi}',
  '\\( \\alpha + \\beta \\)',
  'plain text no math',
  '\\[ \\sum_{i=1}^{n} x_{i} \\]',
  '\\[ \\frac{\\sqrt{a}}{b^{2}} \\]',
];
for (const c of cases) {
  const t = parseLatex(c);
  console.log(JSON.stringify(c), '=>', t ? compileEquation(t) : 'NULL(unparseable)');
}
