import './meta.js?userscript-metadata';
import IRF from 'internet-roadtrip-framework';
import { MOD_LOG_PREFIX } from './constants';
import './settings'; // load settings

if (IRF.isInternetRoadtrip) {
  console.info(MOD_LOG_PREFIX, `UserScript loaded with IRF ${IRF.version}`);
}
