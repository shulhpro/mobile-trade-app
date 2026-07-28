п»їconst fs = require('fs');
let c = fs.readFileSync('C:/bitrix/public/app.js', 'utf8');

const startIdx = c.indexOf('function renderDashboard(dashboard) {');
const endIdx = c.indexOf('function formatMoney(amount) {');

if (startIdx >= 0 && endIdx > startIdx) {
  const before = c.substring(0, startIdx);
  const after = c.substring(endIdx);
  
  const newFunc = [
    'function renderDashboard(dashboard) {',
    '  document.getElementById("totalVisits").textContent = dashboard.totalVisits;',
    '  document.getElementById("totalOrders").textContent = dashboard.totalOrders;',
    '  document.getElementById("totalAmount").textContent = formatMoney(dashboard.totalOrderAmount);',
    '  ',
    '  const employeesTbody = document.querySelector("#employeesTable tbody");',
    '  employeesTbody.innerHTML = "";',
    '  ',
    '  if (dashboard.employeesList && dashboard.employeesList.length > 0) {',
    '    dashboard.employeesList.forEach(emp => {',
    '      const row = document.createElement("tr");',
    '      row.className = "employee-row";',
    '      row.innerHTML = "<td><strong>" + escapeHtml(emp.name) + "</strong></td>" +',
    '        "<td>" + emp.visits + "</td>" +',
    '        "<td>" + emp.orders + "</td>" +',
    '        "<td class=\\"amount\\">" + formatMoney(emp.orderAmount) + "</td>" +',
    '        "<td><button class=\\"btn-toggle\\" onclick=\\"toggleEmployeeClients(this)\\">&#9660; РљР»РёРµРЅС‚С‹ (" + Object.keys(emp.clientsDetails || {}).length + ")</button></td>";',
    '      employeesTbody.appendChild(row);',
    '      ',
    '      const detailsRow = document.createElement("tr");',
    '      detailsRow.className = "client-details-row";',
    '      detailsRow.style.display = "none";',
    '      ',
    '      const clientsDetails = Object.values(emp.clientsDetails || {});',
    '      if (clientsDetails.length > 0) {',
    '        let clientsHtml = "";',
    '        clientsDetails.forEach(client => {',
    '          clientsHtml += "<div class=\\"client-detail-item\\">" +',
    '            "<span class=\\"client-name\\">" + escapeHtml(client.name) + "</span>" +',
    '            "<span class=\\"client-stats\\">Р’РёР·РёС‚РѕРІ: " + client.visits + ", Р—Р°РєР°Р·РѕРІ: " + client.orders + ", РЎСѓРјРјР°: " + formatMoney(client.orderAmount) + "</span>" +',
    '            "</div>";',
    '        });',
    '        detailsRow.innerHTML = "<td colspan=\\"5\\" class=\\"client-details-cell\\">" + clientsHtml + "</td>";',
    '      } else {',
    '        detailsRow.innerHTML = "<td colspan=\\"5\\" class=\\"client-details-cell\\">РќРµС‚ РґР°РЅРЅС‹С… РїРѕ РєР»РёРµРЅС‚Р°Рј</td>";',
    '      }',
    '      employeesTbody.appendChild(detailsRow);',
    '    });',
    '  } else {',
    '    employeesTbody.innerHTML = "<tr><td colspan=\\"5\\" style=\\"text-align:center;padding:20px;color:#999;\\">РќРµС‚ РґР°РЅРЅС‹С…</td></tr>";',
    '  }',
    '}',
    '',
    'function toggleEmployeeClients(btn) {',
    '  const row = btn.closest("tr");',
    '  const detailsRow = row.nextElementSibling;',
    '  if (detailsRow && detailsRow.classList.contains("client-details-row")) {',
    '    if (detailsRow.style.display === "none") {',
    '      detailsRow.style.display = "table-row";',
    '      btn.innerHTML = btn.innerHTML.replace("&#9660;", "&#9650;");',
    '    } else {',
    '      detailsRow.style.display = "none";',
    '      btn.innerHTML = btn.innerHTML.replace("&#9650;", "&#9660;");',
    '    }',
    '  }',
    '}',
    ''
  ].join('\n');
  
  c = before + newFunc + after;
  fs.writeFileSync('C:/bitrix/public/app.js', c, 'utf8');
  console.log('OK');
} else {
  console.log('NOT FOUND: startIdx=' + startIdx + ', endIdx=' + endIdx);
}
