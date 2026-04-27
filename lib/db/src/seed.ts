import { db } from "./index";
import { clientsTable, transactionsTable, tasksTable, inventoryTable, quotesTable } from "./schema";

async function seed() {
  console.log("Seeding database...");

  // Clear all tables
  await db.delete(quotesTable);
  await db.delete(tasksTable);
  await db.delete(transactionsTable);
  await db.delete(inventoryTable);
  await db.delete(clientsTable);

  // Clients
  const clients = await db.insert(clientsTable).values([
    {
      name: "Joao Pereira",
      phone: "11987654321",
      email: "joao@example.com",
      notes: "Cliente fiel, prefere pagamento no pix",
      isDebtor: true,
      debtAmount: "850.00",
    },
    {
      name: "Maria Silva",
      phone: "11912345678",
      email: "maria@email.com",
      notes: "Precisa de nota fiscal sempre",
      isDebtor: false,
      debtAmount: "0",
    },
    {
      name: "Carlos Souza",
      phone: "11999887766",
      email: null,
      notes: null,
      isDebtor: false,
      debtAmount: "0",
    },
    {
      name: "Ana Oliveira",
      phone: "11955443322",
      email: "ana@empresa.com",
      notes: "Contato apenas por WhatsApp",
      isDebtor: false,
      debtAmount: "0",
    },
  ]).returning();

  console.log(`Inserted ${clients.length} clients`);

  const today = new Date();
  const past = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - days);
    return d.toISOString().split("T")[0];
  };
  const future = (days: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + days);
    return d.toISOString().split("T")[0];
  };

  // Transactions (this month)
  await db.insert(transactionsTable).values([
    {
      type: "income",
      amount: "1500.00",
      description: "Servico de manutencao preventiva",
      clientId: clients[0].id,
      isReceivable: false,
    },
    {
      type: "income",
      amount: "800.00",
      description: "Instalacao de ar-condicionado",
      clientId: clients[1].id,
      isReceivable: false,
    },
    {
      type: "expense",
      amount: "350.00",
      description: "Compra de materiais e pecas",
      clientId: null,
      isReceivable: false,
    },
    {
      type: "income",
      amount: "620.00",
      description: "Reparo hidraulico urgente",
      clientId: clients[2].id,
      isReceivable: false,
    },
    {
      type: "expense",
      amount: "200.00",
      description: "Combustivel e transporte",
      clientId: null,
      isReceivable: false,
    },
    {
      type: "income",
      amount: "850.00",
      description: "Pagamento pendente - servico anterior",
      clientId: clients[0].id,
      isReceivable: true,
    },
  ]);

  console.log("Inserted transactions");

  // Tasks
  await db.insert(tasksTable).values([
    {
      title: "Visita tecnica - revisao mensal",
      clientId: clients[1].id,
      dueDate: past(3),
      status: "pending",
    },
    {
      title: "Enviar orcamento revisado",
      clientId: clients[0].id,
      dueDate: past(1),
      status: "pending",
    },
    {
      title: "Cobrar pagamento atrasado",
      clientId: clients[0].id,
      dueDate: today.toISOString().split("T")[0],
      status: "pending",
    },
    {
      title: "Instalar equipamento novo",
      clientId: clients[2].id,
      dueDate: future(2),
      status: "pending",
    },
    {
      title: "Reuniao de alinhamento",
      clientId: clients[3].id,
      dueDate: future(3),
      status: "pending",
    },
    {
      title: "Lavar a amarok",
      clientId: null,
      dueDate: past(5),
      status: "pending",
    },
    {
      title: "Comprar materiais para proxima semana",
      clientId: null,
      dueDate: future(5),
      status: "pending",
    },
    {
      title: "Renovar seguro do carro",
      clientId: null,
      dueDate: future(10),
      status: "completed",
    },
  ]);

  console.log("Inserted tasks");

  // Inventory
  await db.insert(inventoryTable).values([
    { name: "Parafuso M6", quantity: 3, minQuantity: 10, price: "0.50" },
    { name: "Filtro de ar", quantity: 2, minQuantity: 5, price: "45.00" },
    { name: "Fusivel 10A", quantity: 4, minQuantity: 10, price: "2.50" },
    { name: "Fita isolante", quantity: 15, minQuantity: 5, price: "8.00" },
    { name: "Luva de borracha (par)", quantity: 8, minQuantity: 3, price: "22.00" },
    { name: "Cabo flexivel 2,5mm (metro)", quantity: 50, minQuantity: 20, price: "4.50" },
  ]);

  console.log("Inserted inventory");

  // Quotes
  await db.insert(quotesTable).values([
    {
      clientId: clients[1].id,
      description: "Instalacao de sistema de climatizacao — 3 splits 12000 BTUs incluindo materiais",
      amount: "4500.00",
      status: "pending",
    },
    {
      clientId: clients[2].id,
      description: "Manutencao preventiva trimestral — revisao completa do sistema eletrico",
      amount: "1200.00",
      status: "pending",
    },
    {
      clientId: clients[0].id,
      description: "Troca de fiacao da garagem — 30 metros de cabo + quadro de distribuicao",
      amount: "2800.00",
      status: "converted",
    },
  ]);

  console.log("Inserted quotes");
  console.log("Seed complete!");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
