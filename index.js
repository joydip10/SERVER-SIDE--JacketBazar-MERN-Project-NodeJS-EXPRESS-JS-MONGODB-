const express = require('express');
const app = express();
require('dotenv').config();
const { MongoClient } = require('mongodb');
const ObjectId = require("mongodb").ObjectId;
var admin = require("firebase-admin");


const cors = require('cors');
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 500;

//MongoDB url
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.wuxif.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });


//service account
var serviceAccount = require("./jacketbazar-2f4a8-firebase-adminsdk-glw1w-3590ddc57f.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1];

        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {

        }

    }
    next();
}

async function run() {
    try {
        await client.connect();
        const database = client.db("jacketmarket");
        const clothesCollection = database.collection('clothes');
        const reviewCollection = database.collection('reviews');
        const userCollection = database.collection('users');
        const orderCollection = database.collection('orders');

        //GET clothes API
        app.get('/clothes', async (req, res) => {
            const cursor = clothesCollection.find({});
            const results = await cursor.toArray();
            res.json(results);
        })

        //GET reviews API
        app.get('/reviews', async (req, res) => {
            const cursor = reviewCollection.find({});
            const results = await cursor.toArray();
            res.json(results);
        })
        app.post('/reviews', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.json(result);
        })

        app.get('/clothes/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await clothesCollection.findOne(filter);
            res.json(result);
        })
        app.post('/clothes', async (req, res) => {
            const newProduct = req.body;
            const result = await clothesCollection.insertOne(newProduct);
            res.json(result);
        })
        app.delete('/clothes/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await clothesCollection.deleteOne(query);
            res.json(result);
        })
        app.put('/clothes', async (req, res) => {
            const cloth = req.body;
            const query = { _id: ObjectId(cloth.id) };
            const find = await orderCollection.findOne(query);
            const doc = { $set: cloth.data };
            const result = await clothesCollection.updateOne(query, doc);
            console.log(result.modifiedCount);
            res.json(result);
        })

        app.post('/orders', async (req, res) => {
            const order = req.body;
            order.status = "pending";
            const result = await orderCollection.insertOne(order);
            res.json(result);
        })

        app.get('/orders', verifyToken, async (req, res) => {
            if (req.decodedEmail) {
                const cursor = orderCollection.find({});
                const result = await cursor.toArray();
                res.json(result);
            } else {
                res.status(401).json({ message: 'User not Authorized' });
            }
        })

        app.get('/orders/:email', verifyToken, async (req, res) => {
            const queryEmail = req.params.email;
            if (req.decodedEmail === queryEmail) {
                const query = { email: queryEmail };
                const cursor = orderCollection.find(query);
                const result = await cursor.toArray();
                res.json(result);
            } else {
                res.status(401).json({ message: 'User not Authorized' });
            }

        })

        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await orderCollection.deleteOne(query);
            console.log(result.deletedCount);
            res.json(result);
        })

        app.put('/orders', async (req, res) => {
            const Orderid = req.body;
            const query = { _id: ObjectId(Orderid.id) };
            const find = await orderCollection.findOne(query);
            let doc;
            if (find.status === 'pending') {
                doc = { $set: { status: 'approved' } }
            }
            else {
                doc = { $set: { status: 'pending' } }
            }
            const result = await orderCollection.updateOne(query, doc);
            res.json(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await userCollection.insertOne(user);
            console.log(result);
            res.json(result);
        });

        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await userCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        });
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })

        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const requester = req.decodedEmail;
            if (requester) {
                const requesterAccount = await userCollection.findOne({ email: requester });
                if (requesterAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await userCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'you do not have access to make admin' })
            }
        })
    }
    finally {

    }
}

run().catch(console.dir);

//basic api
app.get('/', (req, res) => {
    res.send('CRUD SERVER is activated');
})

app.listen(port, () => {
    console.log(`Listen at http://locahost:${port}`);
});
