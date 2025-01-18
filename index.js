require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
      const query = { email: user.email };
      const existEmail = await userCollection.findOne(query);
      if (existEmail) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get("/users/:role", async (req, res) => {
      const role = req.params.role;
      const query = { role: role };
      const data = await userCollection.find(query).toArray();
      res.send(data);
    }); 

    app.get("/users/:role", async (req, res) => {
      const role = req.params.role;
      const query = { role: role };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/allParcels", async (req, res) => {
      const parcels = await parcelCollection.find().toArray();
      res.send(parcels);
    });

    app.get("/myProfile/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.get("/updateUser/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.patch("/updateUser/:email", async (req, res) => {
      const data = req.body;
      const email = req.params.email;
      const filter = { email: email };
      const update = {
        $set: {
          name: data.name,
          email: data.email,
        },
      };
      const result = await userCollection.updateOne(filter, update);
      res.send(result);
    });

    app.put("/users/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const { image } = req.body;
        if (!image) {
          return res.status(400).json({ error: "Image URL is required" });
        }
        const filter = { email };
        const updateImage = {
          $set: {
            photo: image,
          },
        };

        const result = await userCollection.updateOne(filter, updateImage);

        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "User not found" });
        }

        if (result.modifiedCount === 0) {
          return res
            .status(400)
            .json({ error: "Image not updated. Try again." });
        }

        res.json({
          success: true,
          message: "Profile image updated successfully",
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
      }
    });

    app.get("/bookParcel/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await parcelCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/updateParcel/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelCollection.findOne(query);
      res.send(result);
    });

    app.patch("/updateParcel/:id", async (req, res) => {
      const data = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateParcel = {
        $set: {
          number: data.number,
          type: data.type,
          weight: data.weight,
          receiverName: data.receiverName,
          receiverPhone: data.receiverPhone,
          address: data.address,
          date: data.date,
          latitude: data.latitude,
          longitude: data.longitude,
        },
      };
      const result = await parcelCollection.updateOne(filter, updateParcel);
      res.send(result);
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
