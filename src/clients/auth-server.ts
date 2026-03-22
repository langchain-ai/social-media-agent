import express, { Request, Response, NextFunction } from "express";
import passport from "passport";
import { Strategy as TwitterStrategy } from "passport-twitter";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();

// Extend Express Session type
declare module "express-session" {
  interface SessionData {
    linkedinToken?: string;
    linkedinUserInfo?: any;
  }
}

interface TwitterUser {
  id: string;
  username: string;
  displayName: string;
  photos?: { value: string }[];
  _json: {
    id_str: string;
    screen_name: string;
    name: string;
    profile_image_url_https?: string;
  };
}

export class SocialAuthServer {
  private app: express.Application;
  private port: number;

  constructor(port = 3000) {
    this.app = express();
    this.port = port;
    this.configureMiddleware();
    this.configurePassport();
    this.setupRoutes();
  }

  private configureMiddleware(): void {
    this.app.use(
      session({
        secret: process.env.SESSION_SECRET || "your-session-secret",
        resave: true,
        saveUninitialized: true,
        cookie: {
          secure: false,
          maxAge: 60000,
        },
      }),
    );
    this.app.use(passport.initialize());
    this.app.use(passport.session());
  }

  private configurePassport(): void {
    this.configureTwitterStrategy();
    this.configureLinkedInStrategy();

    passport.serializeUser((user, done) => {
      done(null, user);
    });

    passport.deserializeUser<any>((user, done) => {
      done(null, user);
    });
  }

  private configureTwitterStrategy(): void {
    if (!process.env.TWITTER_API_KEY || !process.env.TWITTER_API_KEY_SECRET) {
      throw new Error("Twitter API credentials are not configured");
    }

    passport.use(
      new TwitterStrategy(
        {
          consumerKey: process.env.TWITTER_API_KEY,
          consumerSecret: process.env.TWITTER_API_KEY_SECRET,
          callbackURL: `http://localhost:${this.port}/auth/twitter/callback`,
        },
        (
          token: string,
          tokenSecret: string,
          profile: TwitterUser,
          done: (error: any, user?: any) => void,
        ) => {
          const user = {
            ...profile,
            token,
            tokenSecret,
          };
          console.log("\n✅ TWITTER USER AUTHENTICATED ✅\n");
          console.dir(user, { depth: null });
          return done(null, user);
        },
      ),
    );
  }

  private configureLinkedInStrategy(): void {
    if (
      !process.env.LINKEDIN_CLIENT_ID ||
      !process.env.LINKEDIN_CLIENT_SECRET
    ) {
      throw new Error("LinkedIn API credentials are not configured");
    }

    // We'll handle LinkedIn authentication directly through routes
    // instead of using passport strategy since we're implementing
    // the OAuth flow manually
  }

  private setupRoutes(): void {
    this.app.get("/", (_req: Request, res: Response) => {
      res.send(
        '<a href="/auth/twitter">Login with Twitter</a><br><a href="/auth/linkedin">Login with LinkedIn</a>',
      );
    });

    // Twitter routes
    this.app.get("/auth/twitter", passport.authenticate("twitter"));
    this.app.get("/auth/twitter/callback", (req: Request, res: Response) => {
      passport.authenticate("twitter", {
        failureRedirect: "/login",
      })(req, res, (err: any) => {
        if (err) {
          console.error("Authentication error:", err);
          return res.redirect("/");
        }
        res.redirect("/");
      });
    });

    // LinkedIn routes
    this.app.get("/auth/linkedin", (_req: Request, res: Response) => {
      const authUrl = new URL(
        "https://www.linkedin.com/oauth/v2/authorization",
      );
      authUrl.searchParams.append("response_type", "code");
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      authUrl.searchParams.append("client_id", process.env.LINKEDIN_CLIENT_ID!);
      authUrl.searchParams.append(
        "redirect_uri",
        "http://localhost:3000/auth/linkedin/callback",
      );
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      authUrl.searchParams.append("state", process.env.SESSION_SECRET!);
      // Includes "w_organization_social" scope for posting to LinkedIn company pages.
      // Remove "w_organization_social" if only posting to personal profiles.
      authUrl.searchParams.append(
        "scope",
        "openid profile email w_member_social w_organization_social",
      );

      res.redirect(authUrl.toString());
    });

    this.app.get("/auth/linkedin/callback", (req: Request, res: Response) => {
      const { code, state } = req.query;

      if (state !== process.env.SESSION_SECRET) {
        return res
          .status(401)
          .send("State mismatch. Possible CSRF attack.") as any;
      }

      if (!code) {
        return res.redirect("/");
      }

      // Handle the LinkedIn OAuth token exchange
      (async () => {
        try {
          const tokenResponse = await fetch(
            "https://www.linkedin.com/oauth/v2/accessToken",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                grant_type: "authorization_code",
                code: code as string,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                client_id: process.env.LINKEDIN_CLIENT_ID!,
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
                redirect_uri: "http://localhost:3000/auth/linkedin/callback",
              }),
            },
          );

          if (!tokenResponse.ok) {
            throw new Error("Failed to get access token");
          }

          const data = await tokenResponse.json();
          console.log("\n✅ LINKEDIN USER AUTHENTICATED ✅\n");
          console.dir(data, { depth: null });

          // Fetch user info using OpenID Connect
          const userInfoResponse = await fetch(
            "https://api.linkedin.com/v2/userinfo",
            {
              headers: {
                Authorization: `Bearer ${data.access_token}`,
              },
            },
          );

          if (!userInfoResponse.ok) {
            throw new Error("Failed to get user info");
          }

          const userInfo = await userInfoResponse.json();
          console.log("\n✅ LINKEDIN USER INFO ✅\n");
          console.dir(userInfo, { depth: null });

          // Store both the token and user info in session
          if (req.session) {
            req.session.linkedinToken = data.access_token;
            req.session.linkedinUserInfo = userInfo;
          }

          res.redirect("/");
        } catch (error) {
          console.error("LinkedIn authentication error:", error);
          res.redirect("/");
        }
      })().catch(console.error);
    });

    this.app.get(
      "/profile",
      this.ensureAuthenticated,
      (req: Request, res: Response) => {
        res.json(req.user);
      },
    );
  }

  private ensureAuthenticated(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    if (req.isAuthenticated()) {
      return next();
    }
    res.redirect("/");
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(
        `Social authentication server is running on port ${this.port}. Go to http://localhost:${this.port} to login`,
      );
    });
  }
}

async function main() {
  const server = new SocialAuthServer();
  server.start();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export default SocialAuthServer;
