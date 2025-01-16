require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const port = process.env.PORT || 5000;
const app = express();
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.haqk7.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.use(cors());
app.use(express.json());

const userCollection = client.db("parcel").collection("users");
const parcelCollection = client.db("parcel").collection("bookParcel");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();


    app.post("/users", async (req, res) => {
      const user = req.body;
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/bookParcel/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email:email };
      const result = await parcelCollection.find(query).toArray()
      res.send(result)
    });


    app.post("/bookParcel", async (req, res) => {
      const data = req.body;
      const result = await parcelCollection.insertOne(data);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Parcel Management System Server is Running.");
});

app.listen(port, () => {
  console.log(`Parcel Management Server is Running on port ${port}`);
});
