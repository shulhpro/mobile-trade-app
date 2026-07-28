п»їconst fs = require('fs');
let c = fs.readFileSync('C:/bitrix/server.js', 'utf8');

const oldPush = `      if (!dashboard.employees[empId].clients.includes(companyName)) {
        dashboard.employees[empId].clients.push(companyName);
      }
      
      if (!dashboard.clients[companyName]) {`;

const newPush = `      if (!dashboard.employees[empId].clients.includes(companyName)) {
        dashboard.employees[empId].clients.push(companyName);
      }
      
      // Accumulate client details per employee
      if (!dashboard.employees[empId].clientsDetails[companyName]) {
        dashboard.employees[empId].clientsDetails[companyName] = {
          name: companyName,
          visits: 0,
          orders: 0,
          orderAmount: 0
        };
      }
      dashboard.employees[empId].clientsDetails[companyName].visits++;
      
      if (!dashboard.clients[companyName]) {`;

if (c.includes(oldPush)) {
  c = c.replace(oldPush, newPush);
  fs.writeFileSync('C:/bitrix/server.js', c, 'utf8');
  console.log('OK');
} else {
  console.log('NOT FOUND');
}
