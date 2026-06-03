import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  console.error("SUPABASE_URL=", SUPABASE_URL);
  console.error("SUPABASE_SERVICE_ROLE_KEY=", SUPABASE_SERVICE_ROLE_KEY ? "<present>" : "<missing>");
  process.exit(1);
}

const ADMIN_EMAIL = "techwithme1001@gmail.com";
const ADMIN_PASSWORD = "Admin123#";
const ADMIN_NAME = "Tech With Me";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const createAdmin = async () => {
  console.log(`Creating or updating admin user: ${ADMIN_EMAIL}`);

  let userId: string | null = null;

  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: {
      full_name: ADMIN_NAME,
      role: "admin"
    }
  });

  if (error) {
    if (error.code === "email_exists" || error.status === 422) {
      console.log(`User already exists: ${ADMIN_EMAIL}, updating existing account.`);
      const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 100 });
      if (listError) {
        console.error("Failed to list Supabase users:", listError);
        process.exit(1);
      }
      const foundUser = listData?.users?.find((user: any) => user.email === ADMIN_EMAIL);
      if (!foundUser) {
        console.error("Existing user not found in Supabase user list.");
        process.exit(1);
      }
      userId = foundUser.id;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: ADMIN_PASSWORD,
        email_confirm: true,
        user_metadata: {
          full_name: ADMIN_NAME,
          role: "admin"
        }
      });
      if (updateError) {
        console.error("Failed to update existing Supabase user:", updateError);
        process.exit(1);
      }
      console.log("Updated existing user password and metadata.");
    } else {
      console.error("Failed to create Supabase user:", error);
      process.exit(1);
    }
  } else {
    userId = data?.user?.id || null;
  }

  if (!userId) {
    console.error("Supabase user ID is unavailable.");
    process.exit(1);
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    email: ADMIN_EMAIL,
    full_name: ADMIN_NAME,
    role: "admin",
    subscription: null
  });

  if (profileError) {
    console.error("Failed to upsert profile:", profileError);
    process.exit(1);
  }

  console.log("✅ Admin user created successfully.");
  console.log(`Email: ${ADMIN_EMAIL}`);
  console.log(`Password: ${ADMIN_PASSWORD}`);
};

createAdmin().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
