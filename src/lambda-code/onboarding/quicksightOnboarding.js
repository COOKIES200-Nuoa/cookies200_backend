const { createQSDashboard } = require('./helpers/createDashboard');
const { createTenant } = require('./helpers/createTenant');

exports.quicksightOnboarding = async (event) => {
    const tenant = event.tenant;
    console.log('Tenant: ', tenant);
// ========= Create Tenant Group =========
    // await createTenant(tenant);

// ========= Create Dashboard and Invite User =========
    await createQSDashboard(tenant)
};