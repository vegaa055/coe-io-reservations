/**
 * NetID sign-in.
 *
 * UA NetID accounts are backed by Microsoft Entra ID, so this uses OIDC against
 * the university tenant. Two providers are registered, and only ever one at a
 * time:
 *
 *   Microsoft Entra ID — whenever the three AUTH_MICROSOFT_ENTRA_ID_* values
 *                        are present. This is the real thing.
 *   Dev sign-in        — a name/email form, registered *only* when Entra is not
 *                        configured and NODE_ENV is not production. It keeps
 *                        local development working before the app registration
 *                        exists, and can never be reached on a deployment.
 *
 * Pinning `issuer` to the university tenant is not cosmetic: the provider
 * defaults to the `common` endpoint, which would let anyone with any Microsoft
 * account — personal Outlook addresses included — complete a sign-in.
 *
 * Roles are deliberately *not* here. Authentication says who you are;
 * authorisation lives in the staff_members table and is read by lib/auth.ts.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

const entraId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID;
const entraSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET;
const entraIssuer = process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER;

/** True once a real identity provider is wired up. */
export const REAL_SIGN_IN_CONFIGURED = Boolean(entraId && entraSecret && entraIssuer);

/** The stand-in used while the campus app registration is still being arranged. */
export const DEV_SIGN_IN_ENABLED =
  !REAL_SIGN_IN_CONFIGURED && process.env.NODE_ENV !== "production";

/** Domains allowed to sign in. Empty means "any address the tenant issued". */
function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function emailAllowed(email: string): boolean {
  const domains = allowedDomains();
  if (domains.length === 0) return true;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return domains.some((d) => domain === d || domain.endsWith(`.${d}`));
}

const providers = [];

if (REAL_SIGN_IN_CONFIGURED) {
  providers.push(
    MicrosoftEntraID({
      clientId: entraId,
      clientSecret: entraSecret,
      issuer: entraIssuer,
      authorization: { params: { scope: "openid profile email" } },
    }),
  );
} else if (DEV_SIGN_IN_ENABLED) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Development sign-in",
      credentials: {
        name: { label: "Name" },
        email: { label: "Email" },
      },
      authorize(credentials) {
        const email = String(credentials?.email ?? "").trim().toLowerCase();
        const name = String(credentials?.name ?? "").trim();
        if (!email.includes("@") || name.length < 2) return null;
        return { id: email, email, name };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  // No database adapter: sessions are stateless JWTs and the only thing we
  // persist about a person is their granted role.
  session: { strategy: "jwt" },
  trustHost: true,
  pages: { signIn: "/signin", error: "/signin" },
  callbacks: {
    /**
     * The tenant already restricts who can authenticate; this is the second
     * gate, for guest accounts invited into the tenant with outside addresses.
     */
    signIn({ user }) {
      return Boolean(user.email && emailAllowed(user.email));
    },
    jwt({ token, user }) {
      if (user?.email) {
        token.email = user.email.toLowerCase();
        token.name = user.name ?? token.name;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.email = (token.email as string) ?? session.user.email;
        session.user.name = (token.name as string) ?? session.user.name;
      }
      return session;
    },
  },
});
