import mongoose from 'mongoose';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/Pharma');
  const Sale = mongoose.connection.collection('sales');
  const sales = await Sale.find({ 'booker_id': new mongoose.Types.ObjectId('6ab551336cc223b556371441') }).toArray();
  console.log('Sales:', sales.map(s => ({ invoice: s.invoice_number, customer: s.customer_id, due: s.due_amount })));
  
  const Customer = mongoose.connection.collection('suppliers');
  const customers = await Customer.find({ _id: { $in: sales.map(s => s.customer_id) } }).toArray();
  console.log('Customers:', customers.map(c => ({ id: c._id, name: c.company_name, pay: c.pay, booker: c.booker_id })));
  process.exit(0);
}
run();
