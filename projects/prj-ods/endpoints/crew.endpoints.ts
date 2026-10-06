import { defineEndpoint } from '../../../src/types';

const validLicenseCrewList = defineEndpoint({
  method: 'GET',
  path: '/validLicenseCrewList',
});

const crewsForFlightNumberAndDatesRange = defineEndpoint({
  method: 'GET',
  path: '/crewsForFlightNumberAndDatesRange',
});

const crewsForFlightDateRangeAndLegsOriginDestination = defineEndpoint({
  method: 'GET',
  path: '/crewsForFlightDateRangeAndLegsOriginDestination',
});

const crewsForRouteDatesRange = defineEndpoint({
  method: 'GET',
  path: '/crewsForRouteDatesRange',
});

const crewsForRouteDatesRangeAndLegsInSegmentsWithOriginAndDestination =
  defineEndpoint({
    method: 'GET',
    path: '/crewsForRouteDatesRangeAndLegsInSegmentsWithOriginAndDestination',
  });

export default {
  validLicenseCrewList,
  crewsForFlightNumberAndDatesRange,
  crewsForFlightDateRangeAndLegsOriginDestination,
  crewsForRouteDatesRange,
  crewsForRouteDatesRangeAndLegsInSegmentsWithOriginAndDestination,
};