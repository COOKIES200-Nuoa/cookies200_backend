const { createQSDataSource } = require("./createQSDataSource");

exports.importQS = async (event) => {
    const dataSourceName = event.dataSourceName;
    const dataSourceId = `${dataSourceName}-id`;

    const sqlQuery = `
        WITH RECURSIVE C(id, Amount_LocationBased, Amount_MarketBased, RootID, tenantid, percentage, level) AS (
        SELECT 
            entityid AS id,
            CAST(COALESCE(emissioninkgco2, emissioninkgco2_forlocationbased, 0) AS DECIMAL) AS Amount_LocationBased,
            CAST(COALESCE(emissioninkgco2, emissioninkgco2_formarketbased, 0) AS DECIMAL) AS Amount_MarketBased,
            entityid AS RootID,
            tenantid,
            parentcontributionpercentage AS percentage,
            0 AS level
        FROM nuoa_joinedtable_test.nuoa_test_joinedtable

        UNION ALL

        SELECT 
            T.parentid AS id,
            C.Amount_LocationBased * C.percentage / 100 AS Amount_LocationBased,
            C.Amount_MarketBased * C.percentage / 100  AS Amount_MarketBased,
            C.RootID,
            C.tenantid,
            C.percentage,
            C.level + 1 AS level
        FROM nuoa_joinedtable_test.nuoa_test_joinedtable AS T
        INNER JOIN C ON T.entityid = C.id AND T.tenantid = C.tenantid
        )
        SELECT 
            T.entityid AS entityid,
            T.parentid,
            T.emissioninkgco2,
            T.emissioninkgco2_forlocationbased,
            T.emissioninkgco2_formarketbased,
            T.parentcontributionpercentage,
            ROUND(S.Cumulative_MarketBased, 0) AS total_emissions_marketbased,
            ROUND(S.Cumulative_LocationBased, 0) AS total_emissions_locationbased
        FROM nuoa_joinedtable_test.nuoa_test_joinedtable AS T
        INNER JOIN (
                    SELECT 
                        id, 
                        SUM(Amount_LocationBased) AS Cumulative_LocationBased,
                        SUM(Amount_MarketBased) AS Cumulative_MarketBased
                    FROM C
                    GROUP BY id
                    ) AS S ON T.entityId = S.id
        ORDER BY T.entityId, T.parentid
    `;
    const columns = [
        {Name: 'Entity ID', Type: 'STRING'},
        {Name: 'Parent ID', Type: 'STRING'},
        {Name: 'Emission in KgCO2', Type: 'INTEGER'},
        {Name: 'Emission in KgCO2 for Market Based', Type: 'INTEGER'},
        {Name: 'Emission in KgCO2 for Location Based', Type: 'INTEGER'},
        {Name: 'Parent Contribution Percentage', Type: 'INTEGER'},
        {Name: 'Total Emission for Market Based', Type: 'DECIMAL'},
        {Name: 'Total Emissions for Location Based', Type: 'DECIMAL'},
    ];
    const datasetName = 'nuoa_emission_dataset';

    const dataSourceArn = await createQSDataSource(dataSourceId, dataSourceName);
}