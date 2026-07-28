п»їconst fs = require('fs');
let c = fs.readFileSync('C:/bitrix/public/index.html', 'utf8');

const startText = '<div class="dashboard-section">\n          <h3>рџЏў РџРѕ РєР»РёРµРЅС‚Р°Рј</h3>';
const startIdx = c.indexOf(startText);
const endIdx = c.indexOf('</div>\n        </div>\n      </section>', startIdx);

if (startIdx >= 0 && endIdx > startIdx) {
  c = c.substring(0, startIdx) + c.substring(endIdx + 8);
  fs.writeFileSync('C:/bitrix/public/index.html', c, 'utf8');
  console.log('OK');
} else {
  console.log('NOT FOUND: startIdx=' + startIdx + ', endIdx=' + endIdx);
}
