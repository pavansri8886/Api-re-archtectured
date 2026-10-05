import { defineEndpoint } from '../../../src/types';

const validLicenseCrewList = defineEndpoint({
  method: 'GET',
  path: {
    v1: '/validLicenseCrewList',
    v2: '/validLicenseCrewList',
  },
});

const crewsForFlightNumberAndDatesRange = defineEndpoint({
  method: 'GET',
  path: {
    v1: '/crewsForFlightNumberAndDatesRange',
    v2: '/crewsForFlightNumberAndDatesRange',
  },
});

const crewsForFlightDateRangeAndLegsOriginDestination = defineEndpoint({
  method: 'GET',
  path: {
    v1: '/crewsForFlightDateRangeAndLegsOriginDestination',
    v2: '/crewsForFlightDateRangeAndLegsOriginDestination',
  },
});

const crewsForRouteDatesRange = defineEndpoint({
  method: 'GET',
  path: {
    v1: '/crewsForRouteDatesRange',
    v2: '/crewsForRouteDatesRange',
  },
});

const crewsForRouteDatesRangeAndLegsInSegmentsWithOriginAndDestination =
  defineEndpoint({
    method: 'GET',
    path: {
      v1: '/crewsForRouteDatesRangeAndLegsInSegmentsWithOriginAndDestination',
      v2: '/crewsForRouteDatesRangeAndLegsInSegmentsWithOriginAndDestination',
    },
  });

export default {
  validLicenseCrewList,
  crewsForFlightNumberAndDatesRange,
  crewsForFlightDateRangeAndLegsOriginDestination,
  crewsForRouteDatesRange,
  crewsForRouteDatesRangeAndLegsInSegmentsWithOriginAndDestination,
};
