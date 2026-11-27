import { Route, Switch } from "wouter";
import Today from "./Today";
import MobileJob from "./Job";
import Scan from "./Scan";
import MobileAsset from "./Asset";
import { StockList, PartPage, BinPage, IssueToJob } from "./Stock";
import { ReportFault, RequestsList } from "./Requests";
import { AuditRun, MePage } from "./Me";
import MobileNotifications from "./Notifications";
import { Empty, Screen, TopBar } from "./ui";

/** The phone app at /m. Same account, data and permissions as the full site. */
export default function MobileApp() {
  return (
    <Switch>
      <Route path="/m" component={Today} />
      <Route path="/m/job/:id" component={MobileJob} />
      <Route path="/m/issue/:jobId" component={IssueToJob} />
      <Route path="/m/scan" component={Scan} />
      <Route path="/m/asset/:id" component={MobileAsset} />
      <Route path="/m/stock" component={StockList} />
      <Route path="/m/part/:id" component={PartPage} />
      <Route path="/m/bin/:id" component={BinPage} />
      <Route path="/m/report" component={ReportFault} />
      <Route path="/m/requests" component={RequestsList} />
      <Route path="/m/audit" component={AuditRun} />
      <Route path="/m/me" component={MePage} />
      <Route path="/m/notifications" component={MobileNotifications} />
      <Route>
        <Screen header={<TopBar title="Not found" back="/m" />}><Empty icon="search" title="That screen doesn't exist" /></Screen>
      </Route>
    </Switch>
  );
}
