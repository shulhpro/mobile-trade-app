п»їconst fs = require('fs');
let c = fs.readFileSync('C:/bitrix/public/app.js', 'utf8');

const oldRender = `function renderDashboard(dashboard) {
  // Summary cards
  document.getElementById('totalVisits').textContent = dashboard.totalVisits;
  document.getElementById('totalOrders').textContent = dashboard.totalOrders;
  document.getElementById('totalAmount').textContent = formatMoney(dashboard.totalOrderAmount);
  
  // Employees table
  const employeesTbody = document.querySelector('#employeesTable tbody');
  employeesTbody.innerHTML = '';
  
  if (dashboard.employeesList && dashboard.employeesList.length > 0) {
    dashboard.employeesList.forEach(emp => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${escapeHtml(emp.name)}</strong></td>
        <td>${emp.visits}</td>
        <td>${emp.orders}</td>
        <td class="amount">${formatMoney(emp.orderAmount)}</td>
        <td class="clients-list" title="${escapeHtml(emp.clients.join(', '))}">${escapeHtml(emp.clients.join(', '))}</td>
      `;
      employeesTbody.appendChild(row);
    });
  } else {
    employeesTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">РќРµС‚ РґР°РЅРЅС‹С…</td></tr>';
  }
  
  // Clients table
  const clientsTbody = document.querySelector('#clientsTable tbody');
  clientsTbody.innerHTML = '';
  
  if (dashboard.clientsList && dashboard.clientsList.length > 0) {
    dashboard.clientsList.forEach(client => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td><strong>${escapeHtml(client.name)}</strong></td>
        <td>${client.visits}</td>
        <td>${client.orders}</td>
        <td class="amount">${formatMoney(client.orderAmount)}</td>
      `;
      clientsTbody.appendChild(row);
    });
  } else {
    clientsTbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:20px;color:#999;">РќРµС‚ РґР°РЅРЅС‹С…</td></tr>';
  }
}`;

const newRender = `function renderDashboard(dashboard) {
  // Summary cards
  document.getElementById('totalVisits').textContent = dashboard.totalVisits;
  document.getElementById('totalOrders').textContent = dashboard.totalOrders;
  document.getElementById('totalAmount').textContent = formatMoney(dashboard.totalOrderAmount);
  
  // Employees table with expandable client lists
  const employeesTbody = document.querySelector('#employeesTable tbody');
  employeesTbody.innerHTML = '';
  
  if (dashboard.employeesList && dashboard.employeesList.length > 0) {
    dashboard.employeesList.forEach(emp => {
      // Main employee row
      const row = document.createElement('tr');
      row.className = 'employee-row';
      row.innerHTML = `
        <td><strong>${escapeHtml(emp.name)}</strong></td>
        <td>${emp.visits}</td>
        <td>${emp.orders}</td>
        <td class="amount">${formatMoney(emp.orderAmount)}</td>
        <td><button class="btn-toggle" onclick="toggleEmployeeClients(this)">в–ј РљР»РёРµРЅС‚С‹ (${Object.keys(emp.clientsDetails || {}).length})</button></td>
      `;
      employeesTbody.appendChild(row);
      
      // Client details row (hidden by default)
      const detailsRow = document.createElement('tr');
      detailsRow.className = 'client-details-row';
      detailsRow.style.display = 'none';
      
      const clientsDetails = Object.values(emp.clientsDetails || {});
      if (clientsDetails.length > 0) {
        const clientsHtml = clientsDetails.map(client => `
          <div class="client-detail-item">
            <span class="client-name">${escapeHtml(client.name)}</span>
            <span class="client-stats">Р’РёР·РёС‚РѕРІ: ${client.visits}, Р—Р°РєР°Р·РѕРІ: ${client.orders}, РЎСѓРјРјР°: ${formatMoney(client.orderAmount)}</span>
          </div>
        `).join('');
        
        detailsRow.innerHTML = `<td colspan="5" class="client-details-cell">${clientsHtml}</td>`;
      } else {
        detailsRow.innerHTML = '<td colspan="5" class="client-details-cell">РќРµС‚ РґР°РЅРЅС‹С… РїРѕ РєР»РёРµРЅС‚Р°Рј</td>';
      }
      employeesTbody.appendChild(detailsRow);
    });
  } else {
    employeesTbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:20px;color:#999;">РќРµС‚ РґР°РЅРЅС‹С…</td></tr>';
  }
}

function toggleEmployeeClients(btn) {
  const row = btn.closest('tr');
  const detailsRow = row.nextElementSibling;
  if (detailsRow && detailsRow.classList.contains('client-details-row')) {
    if (detailsRow.style.display === 'none') {
      detailsRow.style.display = 'table-row';
      btn.textContent = btn.textContent.replace('в–ј', 'в–І');
    } else {
      detailsRow.style.display = 'none';
      btn.textContent = btn.textContent.replace('в–І', 'в–ј');
    }
  }
}`;

if (c.includes(oldRender)) {
  c = c.replace(oldRender, newRender);
  fs.writeFileSync('C:/bitrix/public/app.js', c, 'utf8');
  console.log('OK');
} else {
  console.log('NOT FOUND');
}
