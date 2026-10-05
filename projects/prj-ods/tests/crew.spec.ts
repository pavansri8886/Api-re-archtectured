/**
 * projects/prj-ods/tests/crew.spec.ts
 * The crew API of project prj-ods. For every row in testdata/crew.testdata.json it creates:
 *   [contract]  the response of each version in contractVersions (default V2): status, schema, expected values
 *   [compare]   V1 against V2 for the same row (only if the project has compare enabled)
 * Both kinds carry the row's tags and the endpoint name in the title.
 * Run one endpoint:  npx playwright test --project=api -g "validLicenseCrewList"
 */
import { test } from '../../../src/fixtures';
import { apiContextFrom } from '../../../src/config/projectConfig';
import { planApi, runCompareTest, runContractTest, tagsOf, titleOf } from '../../../src/steps';
import endpoints from '../endpoints/crew.endpoints';

const ctx = apiContextFrom(__dirname, 'crew');
const plan = planApi(ctx, endpoints); // on a setup problem this registers one failing test and returns nothing

for (const row of plan?.rows ?? []) {
  for (const version of plan?.contractVersions ?? []) {
    test(titleOf(`contract ${version.toUpperCase()}`, row), { tag: tagsOf(row) }, async ({ session }) => {
      await runContractTest(session, ctx, endpoints, row, version);
    });
  }
  if (plan?.compare) {
    test(titleOf('compare V1 V2', row), { tag: tagsOf(row) }, async ({ session }) => {
      await runCompareTest(session, ctx, endpoints, row);
    });
  }
}
