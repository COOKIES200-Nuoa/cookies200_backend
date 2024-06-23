import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';


export class TenantStack extends cdk.Stack{
    constructor(scope: Construct, id: string, props: cdk.StackProps) {
        super(scope, id, props);

        const userPoolId = cdk.Fn.importValue('UserPoolIdOutput'); // Get User Pool ID from main stack
        const userPoolClientId = cdk.Fn.importValue('UserPoolClientIdOutput'); // Get User Pool Client ID from main stack
        const identityPoolId = cdk.Fn.importValue('IdentityPoolIdOutput'); // Get Identity Pool ID from main stack
        const nuoaAuthRoleArn = cdk.Fn.importValue('NuoaAuthRoleArnOutput'); // Get NuoaAuthRole ARN from main stack

        const roleMappings: { [key: string]: any } = {
            [`cognito-idp.${this.region}.amazonaws.com/${userPoolId}:${userPoolClientId}`]:
                {
                    // Identity provider
                    Type: "Rules",
                    AmbiguousRoleResolution: "Deny",
                    RulesConfiguration: {
                        Rules: [], // Start with an empty rules array
                    },
                },
            };

        // Get tenant groups from context
        const tenantName = this.node.tryGetContext('tenantName') 

        const group = new cognito.CfnUserPoolGroup(this, `${tenantName}`, {
            userPoolId: userPoolId,
            groupName: tenantName,
        });
    
        // Create tenant-specific IAM role
        const tenantRole = new iam.Role(this, `${tenantName}TenantRole`, {
            assumedBy: new iam.PrincipalWithConditions(
            new iam.ArnPrincipal(nuoaAuthRoleArn),
                {
                    StringEquals: {
                    "sts:ExternalId": `${tenantName}`,
                    },
                }
            ),
            description: `Role for ${tenantName}`,
        });
    
        // Add permissions to tenant-specific role
        tenantRole.addToPolicy(
            new iam.PolicyStatement({
                effect: iam.Effect.ALLOW,
                actions: [
                    "quicksight:DescribeDashboard",
                    "quicksight:ListDashboards",
                    "quicksight:GetDashboardEmbedUrl",
                    "quicksight:GenerateEmbedUrlForRegisteredUser",
                    "quicksight:RegisterUser",
                ],
                resources: [
                    `arn:aws:quicksight:${this.region}:${this.account}:namespace/${tenantName}`,
                ],    
            })
        );
    
        // Configure the rule-based mapping
        roleMappings[
            `cognito-idp.${this.region}.amazonaws.com/${userPoolId}:${userPoolClientId}`
        ].RulesConfiguration.Rules.push({
                Claim: "cognito:groups",
                MatchType: "Equals",
                Value: `${tenantName}`,
                RoleARN: tenantRole.roleArn,
            });
        
        const roleMappingsJson = new cdk.CfnJson(this, `RoleMappingsJson`, {
        value: roleMappings,
        });
      
        // Attach the Identity Pool to the User Pool
        new cognito.CfnIdentityPoolRoleAttachment(
            this,
            `IdentityPoolRoleAttachment`,
            {
            identityPoolId: identityPoolId,
            roles: {
                authenticated: nuoaAuthRoleArn,
            },
            roleMappings: roleMappingsJson,
            }
        );
    }
}