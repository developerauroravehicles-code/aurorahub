# AuroraHub

## Setup

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Environment Variables**
   Create a `.env.local` file in the root directory with the following keys:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=your-project-url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

   TWILIO_ACCOUNT_SID=your-sid
   TWILIO_AUTH_TOKEN=your-token
   TWILIO_PHONE_NUMBER=your-twilio-number
   TWILIO_DEFAULT_COUNTRY_CODE=1  # Optional: Default country code for phone formatting (1 for Canada/USA, 90 for Turkey, etc.)

   RESEND_API_KEY=re_xxxxx  # For report email feature (get from resend.com)
   RESEND_FROM_EMAIL=onboarding@resend.dev  # Test domain; use your verified domain for production
   ```

3. **Database Setup**
   Run the SQL found in `supabase/migrations/20240123174800_init_schema.sql` in your Supabase SQL Editor.

   This will create the necessary tables, enums, and RLS policies.

4. **Initial User Setup**
   Since the app uses a custom Dealer Login flow, you need to create at least one Admin or Manager and a Dealer to start.
   
   - Create a Dealer in `dealers` table.
   - Create a User in Supabase Auth.
   - Create a Profile in `profiles` table linked to that User and Dealer (if applicable) with role `aurora_manager` to access the Admin Dashboard.

   Example SQL to create an initial Admin:
   ```sql
   -- Create Dealer (HQ)
   insert into dealers (code, name, address) values ('HQ', 'Aurora HQ', 'Main Office');
   
   -- (After creating user in Auth manually via Dashboard or script)
   -- insert into profiles (id, dealer_id, role, full_name) values ('USER_UUID', 'DEALER_UUID', 'aurora_manager', 'Admin User');
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```

## Features

- **Login**: Dealer Code + Email + Password.
- **Roles**: Sales, Finance, Specialist, Managers.
- **Dashboards**:
  - Sales: Create Demands (with Calendar), View Reports.
  - Finance: Approve/Cancel Demands (triggers SMS).
  - Specialist: View Work List, Complete Jobs.
  - Admin: Manage Employees and Dealers.
- **SMS**: Twilio integration for appointments.
- **Google Drive**: Automatic invoice PDF upload (Dealer > Year > Month folders). See [docs/GOOGLE_DRIVE_SETUP.md](docs/GOOGLE_DRIVE_SETUP.md).

# Aurora-Hub
# aurorahub
# aurorahub
# aurorahub
# aurorahub
# aurorahub
