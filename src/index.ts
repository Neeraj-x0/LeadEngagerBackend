import { clerkMiddleware, createClerkClient } from "@clerk/express";
import express, { Request, Response } from "express";
import "dotenv/config";

const port = process.env.PORT || 3000;

const app = express();

const clerkClient = createClerkClient({
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  apiUrl: "https://api.clerk.com",
  secretKey: process.env.CLERK_SECRET_KEY,
});

app.use(clerkMiddleware({ clerkClient }));

app.use(clerkMiddleware());
//@ts-ignore
app.get("/auth-state", (req: any, res: any) => {
  const authState = req.auth;
  return res.json(authState);
});

//@ts-ignore
app.get("/", async (req: Request, res: Response) => {
  const { emailAddress, password } = req.query;
  if (!emailAddress || !password) {
    return res
      .status(400)
      .json({ error: "Email Address and Password are required" });
  }
  try {
    const users = await clerkClient.users.getUserList({
      emailAddress: [`${emailAddress}`],
    });
    const id = users.data[0].id;
    const isPasswordVerified = await clerkClient.users.verifyPassword({
      password: `${password}`,
      userId: id,
    });
    let verifed = isPasswordVerified.verified;
    res.json({ verifed });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
