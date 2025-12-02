import passport from "passport";
import { Strategy as FacebookStrategy, Profile } from "passport-facebook";

const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID as string;
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET as string;

passport.use(
  new FacebookStrategy(
    {
      clientID: FACEBOOK_APP_ID,
      clientSecret: FACEBOOK_APP_SECRET,
      callbackURL: "/api/auth/facebook/callback",
      profileFields: ["id", "emails", "name"],
    },
    (
      accessToken: string,
      refreshToken: string,
      profile: Profile,
      done: (error: any, user?: Express.User | false) => void
    ) => {
      const user: Express.User = {
        id: profile.id,
        email: profile.emails?.[0]?.value,
        role: "user",
        profile,
      };
      return done(null, user);
    }
  )
);

passport.serializeUser((user: Express.User, done) => {
  done(null, user);
});

passport.deserializeUser((obj: Express.User, done) => {
  done(null, obj);
});

export default passport;
