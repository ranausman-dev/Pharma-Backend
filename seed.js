import mongoose from "mongoose";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { faker } from "@faker-js/faker";

// Import models
import { Area } from "./models/areaModel.js";
import { User } from "./models/userModel.js";
import { SupplierModel } from "./models/supplierModel.js";
import Company from "./models/companyModel.js";
import Generic from "./models/genericModel.js";
import PackSize from "./models/packSizeModel.js";
import ProductType from "./models/productTypeModel.js";
import { ProductModel } from "./models/productModel.js";
import { BatchModel } from "./models/batchModel.js";
import { OrderModel } from "./models/orderModel.js";
import { OrderItemModel } from "./models/orderItemModel.js";
import { BulkCashRecovery } from "./models/bulkCashRecoveryModel.js";
import Permission from "./models/permissionModel.js";

// Load environment variables
dotenv.config();

<<<<<<< HEAD
export async function seed(disconnectAfter = true) {
  try {
    if (mongoose.connection.readyState !== 1) {
      const MONGO_URL = process.env.MONGO_URL;
      if (!MONGO_URL) {
        console.error("❌ MONGO_URL not found in .env");
        return;
      }
      await mongoose.connect(MONGO_URL);
    }
=======
const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("❌ MONGO_URL not found in .env");
  process.exit(1);
}

async function seed() {
  try {
    await mongoose.connect(MONGO_URL);
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa

    // Clear collections
    await Area.deleteMany({});
    await User.deleteMany({});
    await SupplierModel.deleteMany({});
    await Company.deleteMany({});
    await Generic.deleteMany({});
    await PackSize.deleteMany({});
    await ProductType.deleteMany({});
    await ProductModel.deleteMany({});
    await BatchModel.deleteMany({});
    await OrderModel.deleteMany({});
    await OrderItemModel.deleteMany({});
    await BulkCashRecovery.deleteMany({});
    await Permission.deleteMany({});

    // Seed admin
    const adminPassword = await bcrypt.hash("123456", 10);
    const admin = new User({
      name: "Admin",
      email: "admin@gmail.com",
      password: adminPassword,
      role: "admin",
      status: "active",
      tokenVersion: 0,
    });
    await admin.save();
    
    await new Permission({
      userId: admin._id,
      permissions: ["all"],
    }).save();

    const cities = ["Sargodha", "Lahore", "Faisalabad", "Islamabad", "Karachi"];
    const areaNames = [
      "Satellite Town", "Gulberg", "Model Town", "DHA Phase 5", 
      "Civil Lines", "University Road", "Ferozepur Road", "Samanabad"
    ];

    const areas = [];
    for (const name of areaNames) {
      const area = new Area({
        name,
        city: faker.helpers.arrayElement(cities),
        description: faker.lorem.sentence(),
        status: "active"
      });
      await area.save();
      areas.push(area);
    }

    const employees = [];
    const employeeTypes = ["booker", "supply_man", "order_taker", "tea_man", "it", "branch_manager", "ceo"];
    const incentiveTypes = ["recovery", "sale", "none"];

    for (let i = 0; i < 8; i++) {
      const name = faker.person.fullName();
      const email = faker.internet.email({ firstName: name.split(' ')[0] }).toLowerCase();
      const employee = new User({
        name,
        father_name: faker.person.fullName(),
        email,
        password: await bcrypt.hash("123456", 10),
        phone_number: faker.phone.number(),
        mobile_number: faker.phone.number(),
        salary: faker.number.int({ min: 25000, max: 80000 }),
        city: faker.helpers.arrayElement(cities),
        area_id: [faker.helpers.arrayElement(areas)._id],
        role: "employee",
        employee_type: faker.helpers.arrayElement(employeeTypes),
        incentive_type: faker.helpers.arrayElement(incentiveTypes),
        incentive_percentage: faker.number.int({ min: 1, max: 10 }),
        join_date: faker.date.past({ years: 2 }),
        cnic: "38403-" + faker.string.numeric(7) + "-" + faker.string.numeric(1),
        status: "active",
      });
      await employee.save();
      employees.push(employee);

      // Create permissions for employees
      await new Permission({
        userId: employee._id,
        permissions: ["sales", "parties", "products", "cash"],
      }).save();
    }

    const companies = [];
    const companyNames = ["GSK", "Pfizer", "Novartis", "Abbott", "Getz Pharma", "Ferozsons", "Searle", "Hilton Pharma"];
    for (const name of companyNames) {
      const company = new Company({
        name,
        ptcl_number: faker.phone.number(),
        phone_number: faker.phone.number(),
        address: faker.location.streetAddress(),
        email: faker.internet.email({ provider: name.toLowerCase().replace(/\s/g, '') }),
        city: faker.helpers.arrayElement(cities),
      });
      await company.save();
      companies.push(company);
    }

    const generics = [];
    const genericNames = [
      { name: "Paracetamol", short_name: "PARA" },
      { name: "Ibuprofen", short_name: "IBU" },
      { name: "Amoxicillin", short_name: "AMOX" },
      { name: "Metformin", short_name: "MET" },
      { name: "Atorvastatin", short_name: "ATOR" },
      { name: "Omeprazole", short_name: "OMEP" },
      { name: "Ciprofloxacin", short_name: "CIPR" },
      { name: "Loratadine", short_name: "LORA" }
    ];
    for (const gen of genericNames) {
      const generic = new Generic({
        name: gen.name,
        short_name: gen.short_name
      });
      await generic.save();
      generics.push(generic);
    }

    const packSizes = [];
    const packNames = ["10s", "20s", "30s", "100s", "120ml", "60ml", "10x10", "30x10"];
    for (const name of packNames) {
      const pSize = new PackSize({ name });
      await pSize.save();
      packSizes.push(pSize);
    }

    const productTypes = [];
    const ptNames = ["Tablet", "Syrup", "Injection", "Capsule", "Cream", "Drops"];
    for (const name of ptNames) {
      const pType = new ProductType({ name });
      await pType.save();
      productTypes.push(pType);
    }

    const parties = [];
    const bookers = employees.filter(e => e.employee_type === "booker" || e.employee_type === "ceo");
    
    // We need at least one booker. If none, use the first employee
    const defaultBooker = bookers.length > 0 ? bookers[0] : employees[0];

    for (let i = 0; i < 25; i++) {
      const company_name = faker.company.name() + " Pharmacy";
      const role = faker.helpers.arrayElement(["customer", "supplier", "both"]);
      const partyAreas = [
        faker.helpers.arrayElement(areas)._id,
        faker.helpers.arrayElement(areas)._id
      ];
      
      const party = new SupplierModel({
        owner1_name: faker.person.fullName(),
        owner2_name: faker.person.fullName(),
        email: faker.internet.email(),
        owner1_phone_number: faker.phone.number(),
        owner2_phone_number: faker.phone.number(),
        company_name,
        phone_number: faker.phone.number(),
        ptcl_number: faker.phone.number(),
        address: faker.location.streetAddress(),
        area_id: partyAreas,
        city: faker.helpers.arrayElement(cities),
        booker_id: faker.helpers.arrayElement(bookers.length > 0 ? bookers : [defaultBooker])._id,
        role,
        receive: faker.number.int({ min: 1000, max: 50000 }), // Dr balance (amount customer owes us)
        pay: faker.number.int({ min: 0, max: 20000 }),       // Cr balance (amount we owe supplier)
        status: "active",
        opening_balance: faker.number.int({ min: 0, max: 10000 }),
        balanceType: faker.helpers.arrayElement(["pay", "receive"]),
        credit_period: faker.number.int({ min: 7, max: 30 }),
        credit_limit: faker.number.int({ min: 50000, max: 200000 }),
        cnic: "38403-" + faker.string.numeric(7) + "-" + faker.string.numeric(1),
      });
      await party.save();
      parties.push(party);
    }

    const products = [];
    const productNames = [
      "Panadol 500mg", "Brufen 400mg", "Amoxil 250mg", "Glucophage 500mg", 
      "Lipiget 10mg", "Risek 20mg", "Ciproxin 500mg", "Softin 10mg", 
      "Panadol Extra", "Brufen DS Syrup", "Amoxil Capsule 500mg", "Glucophage 1000mg",
      "Risek 40mg Capsule", "Caval Syrup", "Polyfax Ointment", "Surbex-Z"
    ];

    for (let i = 0; i < productNames.length; i++) {
      const retail = faker.number.int({ min: 100, max: 1500 });
      // trade price is usually slightly lower than retail
      const trade = Math.round(retail * 0.85); 
      const prod = new ProductModel({
        company_id: faker.helpers.arrayElement(companies)._id,
        generic_id: faker.helpers.arrayElement(generics)._id,
        name: productNames[i],
        pack_size_id: faker.helpers.arrayElement(packSizes)._id,
        carton_size: "12x10",
        quantity_alert: faker.number.int({ min: 5, max: 20 }),
        barcode_symbology: "EAN13",
        item_code: "PRD-" + faker.string.numeric(5),
        product_type: faker.helpers.arrayElement(productTypes)._id,
        retail_price: retail,
        trade_price: trade,
        trade_price_percentage: 15,
        wholesale_price: Math.round(trade * 0.95),
        wholesale_price_percentage: 5,
        federal_tax: 0,
        federal_tax_percentage: 0,
        gst: 0,
        gst_percentage: 0,
        sales_tax: 0,
        sales_tax_percentage: 0
      });
      await prod.save();
      products.push(prod);
    }

    const batches = [];
    for (const prod of products) {
      // 1-2 batches per product
      const numBatches = faker.number.int({ min: 1, max: 2 });
      for (let j = 0; j < numBatches; j++) {
        const batchNum = "B-" + faker.string.alphanumeric(6).toUpperCase();
        const purchasePrice = Math.round(prod.trade_price * 0.9); // our cost is lower than trade price
        const stock = faker.number.int({ min: 50, max: 500 });
        const expiry = faker.date.future({ years: 2 });
        const expiryStr = `${expiry.getDate().toString().padStart(2, '0')}/${(expiry.getMonth() + 1).toString().padStart(2, '0')}/${expiry.getFullYear()}`;
        
        const b = new BatchModel({
          product_id: prod._id,
          batch_number: batchNum,
          purchase_price: purchasePrice,
          stock,
          unit_cost: purchasePrice,
          discount_per_unit: 0,
          expiry_date: expiryStr,
          retail_price: prod.retail_price,
          trade_price: prod.trade_price,
          wholesale_price: prod.wholesale_price,
          sales_tax: 0
        });
        await b.save();
        batches.push(b);
      }
    }

    const suppliers = parties.filter(p => p.role === "supplier" || p.role === "both");
    const customers = parties.filter(p => p.role === "customer" || p.role === "both");

    // Create Purchases (Stock Ins)
    let purchaseCounter = 1;
    for (let k = 0; k < 12; k++) {
      const supplier = faker.helpers.arrayElement(suppliers);
      const itemsCount = faker.number.int({ min: 2, max: 5 });
      let subtotal = 0;

      const orderItemsToInsert = [];
      const chosenBatches = faker.helpers.arrayElements(batches, itemsCount);
      
      for (const batch of chosenBatches) {
        const prod = products.find(p => p._id.toString() === batch.product_id.toString());
        if (!prod) continue;

        const units = faker.number.int({ min: 10, max: 50 });
        const unitPrice = batch.purchase_price;
        const totalItem = units * unitPrice;
        subtotal += totalItem;

        orderItemsToInsert.push({
          product_id: prod._id,
          batch: batch.batch_number,
          expiry: batch.expiry_date,
          units,
          unit_price: unitPrice,
          discount: 0,
          profit: 0,
          total: totalItem,
          retail_price: prod.retail_price,
          trade_price: prod.trade_price,
        });
      }

      const order = new OrderModel({
        invoice_number: null,
        purchase_number: "PUR-" + purchaseCounter++,
        supplier_id: supplier._id,
        booker_id: null,
        subtotal,
        total: subtotal,
        paid_amount: subtotal, // Paid in full
        due_amount: 0,
        net_value: subtotal,
        type: "purchase",
        status: "completed"
      });

      await order.save();

      for (const item of orderItemsToInsert) {
        item.order_id = order._id;
        const orderItem = new OrderItemModel(item);
        await orderItem.save();
      }
    }

    // Create Sales (Invoices)
    let saleCounter = 1;
    for (let k = 0; k < 35; k++) {
      const customer = faker.helpers.arrayElement(customers);
      const booker = faker.helpers.arrayElement(bookers.length > 0 ? bookers : [defaultBooker]);
      const itemsCount = faker.number.int({ min: 1, max: 4 });
      let subtotal = 0;
      let totalProfit = 0;

      const orderItemsToInsert = [];
      const chosenBatches = faker.helpers.arrayElements(batches, itemsCount);

      for (const batch of chosenBatches) {
        const prod = products.find(p => p._id.toString() === batch.product_id.toString());
        if (!prod) continue;

        const units = faker.number.int({ min: 2, max: 15 });
        const unitPrice = prod.trade_price; // Sale is done at trade price usually
        const costPrice = batch.purchase_price;
        const discount = faker.helpers.arrayElement([0, 5, 10]); // discount percentage
        const discountVal = (unitPrice * discount / 100);
        const finalUnitPrice = unitPrice - discountVal;

        const totalItem = units * finalUnitPrice;
        const profitItem = (finalUnitPrice - costPrice) * units;

        subtotal += totalItem;
        totalProfit += profitItem;

        orderItemsToInsert.push({
          product_id: prod._id,
          batch: batch.batch_number,
          expiry: batch.expiry_date,
          units,
          unit_price: finalUnitPrice,
          discount,
          profit: profitItem,
          total: totalItem,
          retail_price: prod.retail_price,
          trade_price: prod.trade_price,
        });

        // Deduct stock from the batch
        batch.stock = Math.max(0, batch.stock - units);
        await batch.save();
      }

      const total = subtotal;
      const paidPercent = faker.helpers.arrayElement([0.3, 0.5, 0.8, 1]);
      const paid = Math.round(total * paidPercent);
      const due = total - paid;

      const order = new OrderModel({
        invoice_number: "SALE-" + saleCounter++,
        purchase_number: null,
        supplier_id: customer._id,
        booker_id: booker._id,
        subtotal,
        total,
        paid_amount: paid,
        due_amount: due,
        net_value: total,
        profit: totalProfit,
        type: "sale",
        status: due === 0 ? "completed" : "partially_recovered",
        createdAt: faker.date.past({ years: 1 }) // spread sales over the past year
      });

      await order.save();

      for (const item of orderItemsToInsert) {
        item.order_id = order._id;
        const orderItem = new OrderItemModel(item);
        await orderItem.save();
      }
    }

    // Create Sales Returns (returns)
    let returnCounter = 1;
    const saleOrders = await OrderModel.find({ type: "sale" });
    for (let r = 0; r < 8; r++) {
      if (saleOrders.length === 0) break;
      const sale = faker.helpers.arrayElement(saleOrders);
      const saleItems = await OrderItemModel.find({ order_id: sale._id });
      if (saleItems.length === 0) continue;

      const itemToReturn = faker.helpers.arrayElement(saleItems);
      const unitsReturned = faker.number.int({ min: 1, max: Math.max(1, itemToReturn.units - 1) });
      const returnAmount = unitsReturned * itemToReturn.unit_price;
      const profitReduced = unitsReturned * (itemToReturn.unit_price - (itemToReturn.profit / itemToReturn.units));

      // Create return order
      const returnOrder = new OrderModel({
        invoice_number: "RTN-" + returnCounter++,
        supplier_id: sale.supplier_id,
        booker_id: sale.booker_id,
        subtotal: returnAmount,
        total: returnAmount,
        paid_amount: 0,
        due_amount: returnAmount,
        net_value: returnAmount,
        profit: -profitReduced,
        type: "sale_return",
        status: "returned"
      });

      await returnOrder.save();

      const returnItem = new OrderItemModel({
        order_id: returnOrder._id,
        product_id: itemToReturn.product_id,
        batch: itemToReturn.batch,
        expiry: itemToReturn.expiry,
        units: unitsReturned,
        unit_price: itemToReturn.unit_price,
        discount: itemToReturn.discount,
        profit: -profitReduced,
        total: returnAmount,
      });
      await returnItem.save();
    }

    let recoveryCounter = 1;
    for (let c = 0; c < 20; c++) {
      const customer = faker.helpers.arrayElement(customers);
      const booker = faker.helpers.arrayElement(bookers.length > 0 ? bookers : [defaultBooker]);

      const recovery = new BulkCashRecovery({
        cash_id: "CASH-" + recoveryCounter++,
        customer_id: customer._id,
        booker_id: booker._id,
        amount: faker.number.int({ min: 500, max: 15000 }),
        date: faker.date.past({ years: 1 }),
        note: faker.helpers.arrayElement(["Cash recovery", "Partial collection", "Weekly dues", "Bulk balance sheet recovery", "Regular recovery"]),
        status: "active"
      });
      await recovery.save();
    }

<<<<<<< HEAD
    if (disconnectAfter) {
      await mongoose.disconnect();
    }
    console.log("✅ Seeding completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
  }
}

// Run directly if this script was executed directly
if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`) {
  seed(true);
}
=======
    mongoose.disconnect();
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seed();
>>>>>>> 54864e09bfb82fba45a6586c3ecb7b9f2ac0e4aa
