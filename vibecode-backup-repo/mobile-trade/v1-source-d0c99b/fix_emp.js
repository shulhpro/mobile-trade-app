п»їconst fs=require('fs');
let c=fs.readFileSync('C:/bitrix/server.js','utf8');

// Find and replace the employees initialization
const oldInit = `      if (!dashboard.employees[empId]) {
        dashboard.employees[empId] = {
          id: empId,
          name: empName,
          visits: 0,
          orders: 0,
          orderAmount: 0,
          clients: []
        };
      }`;

const newInit = `      if (!dashboard.employees[empId]) {
        dashboard.employees[empId] = {
          id: empId,
          name: empName,
          visits: 0,
          orders: 0,
          orderAmount: 0,
          clients: [],
          clientsDetails: {}
        };
      }`;

if(c.includes(oldInit)){
  c=c.replace(oldInit, newInit);
  fs.writeFileSync('C:/bitrix/server.js',c,'utf8');
  console.log('OK - Added clientsDetails');
} else {
  console.log('NOT FOUND - employees init');
}
