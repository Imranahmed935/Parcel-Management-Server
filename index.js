require("dotenv").config();
const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { default: Stripe } = require("stripe");
const port = process.env.PORT || 5000;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
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
const assignDeliveryMan = client.db("parcel").collection("delivery");
const deliveredParcel = client.db("parcel").collection("allParcel");
const reviews = client.db("parcel").collection("allReviews");

const verifyToken = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.SECRET_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const verifyAdmin = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await userCollection.findOne(query);
  const isAdmin = user?.role === "admin";
  if (!isAdmin) {
    return res.status(403).send({ message: "forbidden access" });
  }
  next();
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

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

    app.get("/allDelivered", async (req, res) => {
      const data = await deliveredParcel.find().toArray();
      res.send(data);
    });

    app.get("/stats", async (req, res) => {
      const totalUsers = await userCollection.estimatedDocumentCount();
      const totalParcel = await parcelCollection.estimatedDocumentCount();
      const totalDelivered = await deliveredParcel.estimatedDocumentCount();
      res.send({
        totalDelivered,
        totalParcel,
        totalUsers,
      });
    });

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.SECRET_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    app.get("/users/role/:email", async (req, res) => {
      const email = req.params.email;
      const result = await userCollection.findOne({ email });
      res.send({ role: result?.role });
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }

      res.send({ admin });
    });

    app.get("/users/reviews", async (req, res) => {
      const data = await reviews.find().toArray();
      res.send(data);
    });

    app.get("/users/:email", verifyToken, verifyAdmin, async (req, res) => {
      const page = parseInt(req.query.currentPage);
      const limit = parseInt(req.query.itemsParPage);
      const query = { role: { $ne: "admin" } };

      const result = await userCollection
        .find(query)
        .skip(page * limit)
        .limit(limit)
        .toArray();
      res.send(result);
    });

    app.get("/allUsers", async (req, res) => {
      const count = await userCollection.estimatedDocumentCount();
      res.send({ count });
    });

    // alldeliveryman
    app.get(
      "/users/allDeliveryMan/:role",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const role = req.params.role;
        const query = { role: role };
        const result = await userCollection.find(query).toArray();
        res.send(result);
      }
    );

    app.get("/delivery/:role", verifyToken, verifyAdmin, async (req, res) => {
      const role = req.params.role;
      const query = { role: role };
      const result = await userCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/userDashboard/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const data = await userCollection.findOne(query);
      res.send(data);
    });

    app.patch("/users/user/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "deliveryMan",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            role: "admin",
          },
        };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    app.patch("/user/cancelBooked/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: {
          status: "Returned",
        },
      };
      const result = await parcelCollection.updateOne(filter, update);
      res.send(result);
    });

    app.post("/parcels", verifyToken, verifyAdmin, async (req, res) => {
      const data = req.body;
      const result = await assignDeliveryMan.insertOne(data);
      res.send(result);
    });

    app.get("/deliverList/:email", async (req, res) => {
      const email = req.params.email;
      const query = { deliveryManEmail: email };
      const result = await assignDeliveryMan.find(query).toArray();
      res.send(result);
    });

    app.patch("/deliveryManId/status/:id", async (req, res) => {
      const { deliveryman, deliveryDate } = req.body;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const update = {
        $set: {
          deliveryManId: deliveryman,
          deliveryDate: deliveryDate,
        },
      };
      const result = await parcelCollection.updateOne(query, update);

      res.send(result);
    });

    app.post("/reviews", async (req, res) => {
      const data = req.body;
      const result = await reviews.insertOne(data);
      res.send(result);
    });

    app.put("/review/man/:id", async (req, res) => {
      const id = req.params.id;
      const userReview = req.body;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: userReview,
      };

      try {
        const result = await userCollection.updateOne(filter, update);
        res.send(result);
      } catch (error) {
        console.error("Error updating user:", error);
        res.status(500).send({ error: "Failed to update user" });
      }
    });

    app.patch("/users/count/:email", async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const update = {
        $inc: {
          count: 1,
        },
      };
      const result = await userCollection.updateOne(filter, update);
      res.send(result);
    });

    app.patch("/cancelStatus/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateCancel = {
        $set: {
          "selected.status": "Cancelled",
        },
      };
      const assignResult = await assignDeliveryMan.updateOne(
        filter,
        updateCancel
      );

      const assignedParcel = await assignDeliveryMan.findOne(filter);
      const parcelId = assignedParcel?.selected?._id;

      let parcelResult = null;
      if (parcelId) {
        const bookedParcelFilter = { _id: new ObjectId(parcelId) };
        const bookedParcelUpdate = {
          $set: {
            status: "Cancelled",
          },
        };
        parcelResult = await parcelCollection.updateOne(
          bookedParcelFilter,
          bookedParcelUpdate
        );
        res.send({
          message: "Status updated successfully",
          assignUpdated: assignResult,
          bookedParcelUpdated: parcelResult,
        });
      }
    });

    app.patch("/deliverStatus/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateStatus = {
        $set: {
          "selected.status": "delivered",
        },
      };
      const result = await assignDeliveryMan.updateOne(filter, updateStatus);
      const filterId = await assignDeliveryMan.findOne(filter);
      const filteredData = filterId?.selected?._id;
      let delivered = null;
      if (filteredData) {
        const bookedParcel = { _id: new ObjectId(filteredData) };
        const updateDeliver = {
          $set: {
            status: "delivered",
          },
        };
        delivered = await parcelCollection.updateOne(
          bookedParcel,
          updateDeliver
        );
        res.send({
          message: "Status updated successfully",
          result,
          delivered,
        });
      }
    });

    app.post("/deliveredCount", async (req, res) => {
      const data = req.body;
      const result = await deliveredParcel.insertOne(data);
      res.send(result);
    });
    // topDeliveryMan
    app.get("/user/topDeliveryMan/:role", async (req, res) => {
      const role = req.params.role;
      const query = { role: role };

      const result = await userCollection
        .find(query)
        .sort({ count: -1, reviewed: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    });

    app.patch("/users/status/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const update = {
        $set: {
          status: "On the way",
        },
      };
      const result = await parcelCollection.updateOne(filter, update);
      res.send(result);
    });

    app.get("/reviews/:deliveryManId", async (req, res) => {
      const id = req.params.deliveryManId;
      try {
        const reviewsData = await reviews.find({ id: id }).toArray();
        res.send(reviewsData);
      } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).send({ message: "Internal server error" });
      }
    });

    app.get("/singleDeliveryMan/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    app.get("/adminStats", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const bookingsByDate = await parcelCollection
          .aggregate([
            {
              $match: {
                date: { $exists: true, $ne: null },
              },
            },
            {
              $project: {
                bookingDate: { $toDate: "$date" },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" },
                },
                count: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray();

        const bookingVsDelivered = await parcelCollection
          .aggregate([
            {
              $match: {
                date: { $exists: true, $ne: null },
              },
            },
            {
              $project: {
                bookingDate: { $toDate: "$date" },
                status: 1,
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$bookingDate" },
                },
                booked: { $sum: 1 },
                delivered: {
                  $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] },
                },
              },
            },
            { $sort: { _id: 1 } },
          ])
          .toArray();

        const bookingsDate = bookingsByDate.map((book) => book._id);
        const bookingsCount = bookingsByDate.map((book) => book.count);
        const bookedCounts = bookingVsDelivered.map((item) => item.booked);
        const deliveredCounts = bookingVsDelivered.map(
          (item) => item.delivered
        );

        res.send({
          bookingsByDate: {
            dates: bookingsDate,
            counts: bookingsCount,
          },
          bookingVsDelivered: {
            dates: bookingsDate,
            booked: bookedCounts,
            delivered: deliveredCounts,
          },
        });
      } catch (err) {
        console.error("Error occurred on the server:", err);
        res
          .status(500)
          .send({ message: "An error occurred while processing the data." });
      }
    });

    app.get("/allParcels", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;
        const query = {};
        if (startDate && endDate) {
          query.requestedDeliveryDate = {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          };
        }
        const parcels = await parcelCollection.find(query).toArray();
        res.send(parcels);
      } catch (error) {
        console.error("Error fetching parcels:", error);
        res.status(500).send({ message: "Failed to fetch parcels" });
      }
    });

    app.get("/totalBooked", async (req, res) => {
      const data = await parcelCollection.find().toArray();
      res.send(data);
    });

    app.get("/totalParcels", async (req, res) => {
      const data = await deliveredParcel.find().toArray();
      res.send(data);
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
          phone: data.phone,
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
      const filter = req.query.filter;
      const email = req.params.email;
      const query = { email: email };
      if (filter) {
        query.status = filter;
      }
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

    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
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
