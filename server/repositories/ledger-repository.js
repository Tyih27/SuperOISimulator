export class LedgerRepository {
  async recordCurrency(client, { accountId, currency, delta, sourceType, sourceId }) {
    await client.query(
      `INSERT INTO currency_ledger (account_id, currency, delta, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [accountId, currency, delta, sourceType, sourceId],
    );
  }

  async recordInventoryGrant(client, { accountId, itemId, quantity, sourceType, sourceId }) {
    await client.query(
      `INSERT INTO inventory_entries (account_id, item_id, quantity, source_type, source_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [accountId, itemId, quantity, sourceType, sourceId],
    );
  }

  async recordCampaignSettlement(client, { accountId, settlementId, levelId }) {
    const result = await client.query(
      `INSERT INTO campaign_settlements (account_id, settlement_id, level_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id, settlement_id) DO NOTHING
       RETURNING settlement_id`,
      [accountId, settlementId, levelId],
    );
    return result.rowCount === 1;
  }

  async claimShopPurchase(client, { accountId, offerId, resetPeriod }) {
    const result = await client.query(
      `INSERT INTO shop_purchase_limits (account_id, offer_id, reset_period)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id, offer_id, reset_period) DO NOTHING
       RETURNING offer_id`,
      [accountId, offerId, resetPeriod],
    );
    return result.rowCount === 1;
  }

  async claimDailyCheckIn(client, { accountId, claimPeriod }) {
    const result = await client.query(
      `INSERT INTO daily_checkins (account_id, claim_period)
       VALUES ($1, $2)
       ON CONFLICT (account_id, claim_period) DO NOTHING
       RETURNING claim_period`,
      [accountId, claimPeriod],
    );
    return result.rowCount === 1;
  }
}
