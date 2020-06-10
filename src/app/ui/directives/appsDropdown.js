/* @ngInject */
function appsDropdown($filter, authentication) {
    const humanSize = $filter('humanSize');
    return {
        scope: {},
        replace: true,
        restrict: 'E',
        templateUrl: require('../../../templates/ui/appsDropdown.tpl.html'),
        link(scope) {
            const { UsedSpace, MaxSpace } = authentication.user;
            const percentage = Math.round((UsedSpace * 100) / MaxSpace);
            scope.spacePercentage = isNaN(percentage) ? 0 : percentage;
            scope.spaceHuman = `${humanSize(UsedSpace)} / ${humanSize(MaxSpace)}`;
        }
    };
}
export default appsDropdown;
