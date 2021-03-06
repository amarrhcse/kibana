/*
 * Copyright Elasticsearch B.V. and/or licensed to Elasticsearch B.V. under one
 * or more contributor license agreements. Licensed under the Elastic License;
 * you may not use this file except in compliance with the Elastic License.
 */

import { SPACES } from '../../common/lib/spaces';
import { testCaseFailures, getTestScenarios } from '../../common/lib/saved_object_test_utils';
import { TestUser } from '../../common/lib/types';
import { FtrProviderContext } from '../../common/ftr_provider_context';
import {
  resolveImportErrorsTestSuiteFactory,
  TEST_CASES as CASES,
  ResolveImportErrorsTestDefinition,
} from '../../common/suites/resolve_import_errors';

const {
  DEFAULT: { spaceId: DEFAULT_SPACE_ID },
  SPACE_1: { spaceId: SPACE_1_ID },
  SPACE_2: { spaceId: SPACE_2_ID },
} = SPACES;
const { fail400, fail409 } = testCaseFailures;

const createTestCases = (overwrite: boolean, spaceId: string) => {
  // for each permitted (non-403) outcome, if failure !== undefined then we expect
  // to receive an error; otherwise, we expect to receive a success result
  const importableTypes = [
    {
      ...CASES.SINGLE_NAMESPACE_DEFAULT_SPACE,
      ...fail409(!overwrite && spaceId === DEFAULT_SPACE_ID),
    },
    { ...CASES.SINGLE_NAMESPACE_SPACE_1, ...fail409(!overwrite && spaceId === SPACE_1_ID) },
    { ...CASES.SINGLE_NAMESPACE_SPACE_2, ...fail409(!overwrite && spaceId === SPACE_2_ID) },
    { ...CASES.NAMESPACE_AGNOSTIC, ...fail409(!overwrite) },
    CASES.NEW_SINGLE_NAMESPACE_OBJ,
    CASES.NEW_NAMESPACE_AGNOSTIC_OBJ,
  ];
  const nonImportableTypes = [
    { ...CASES.MULTI_NAMESPACE_DEFAULT_AND_SPACE_1, ...fail400() },
    { ...CASES.MULTI_NAMESPACE_ONLY_SPACE_1, ...fail400() },
    { ...CASES.MULTI_NAMESPACE_ONLY_SPACE_2, ...fail400() },
    { ...CASES.HIDDEN, ...fail400() },
    { ...CASES.NEW_MULTI_NAMESPACE_OBJ, ...fail400() },
  ];
  const allTypes = importableTypes.concat(nonImportableTypes);
  return { importableTypes, nonImportableTypes, allTypes };
};

export default function ({ getService }: FtrProviderContext) {
  const supertest = getService('supertestWithoutAuth');
  const esArchiver = getService('esArchiver');
  const es = getService('legacyEs');

  const { addTests, createTestDefinitions, expectForbidden } = resolveImportErrorsTestSuiteFactory(
    es,
    esArchiver,
    supertest
  );
  const createTests = (overwrite: boolean, spaceId: string) => {
    const { importableTypes, nonImportableTypes, allTypes } = createTestCases(overwrite, spaceId);
    const singleRequest = true;
    // use singleRequest to reduce execution time and/or test combined cases
    return {
      unauthorized: [
        createTestDefinitions(importableTypes, true, overwrite, { spaceId }),
        createTestDefinitions(nonImportableTypes, false, overwrite, { spaceId, singleRequest }),
        createTestDefinitions(allTypes, true, overwrite, {
          spaceId,
          singleRequest,
          responseBodyOverride: expectForbidden(['dashboard', 'globaltype', 'isolatedtype']),
        }),
      ].flat(),
      authorized: createTestDefinitions(allTypes, false, overwrite, { spaceId, singleRequest }),
    };
  };

  describe('_resolve_import_errors', () => {
    getTestScenarios([false, true]).securityAndSpaces.forEach(
      ({ spaceId, users, modifier: overwrite }) => {
        const suffix = ` within the ${spaceId} space${overwrite ? ' with overwrite enabled' : ''}`;
        const { unauthorized, authorized } = createTests(overwrite!, spaceId);
        const _addTests = (user: TestUser, tests: ResolveImportErrorsTestDefinition[]) => {
          addTests(`${user.description}${suffix}`, { user, spaceId, tests });
        };

        [
          users.noAccess,
          users.legacyAll,
          users.dualRead,
          users.readGlobally,
          users.readAtSpace,
          users.allAtOtherSpace,
        ].forEach((user) => {
          _addTests(user, unauthorized);
        });
        [users.dualAll, users.allGlobally, users.allAtSpace, users.superuser].forEach((user) => {
          _addTests(user, authorized);
        });
      }
    );
  });
}
