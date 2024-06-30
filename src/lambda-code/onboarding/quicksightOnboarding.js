const { createQSDashboard } = require('./helpers/createDashboard');
const { createTenant } = require('./helpers/createTenant');

exports.quicksightOnboarding = async (event) => {
    const tenant = event.detail.requestParameters.groupName;
    const email = `${tenant}@hotmail.com`;
    console.log('Tenant: ', tenant);
// ========= Create Tenant Group =========
    const tenantRoleArn = await createTenant(tenant);

// ========= Create Dashboard and Invite User =========
    await createQSDashboard(tenant, email, tenantRoleArn);
};