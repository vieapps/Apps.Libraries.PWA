import { Component, ViewChild } from "@angular/core";
import { NavController, NavParams, ActionSheetController, AlertController, Searchbar, InfiniteScroll } from "ionic-angular";
import { Keyboard } from "@ionic-native/keyboard";
import { List } from "linqts";

import { AppUtility } from "../../../helpers/utility";
import { AppEvents } from "../../../helpers/events";
import { AppData } from "../../../models/data";
import { AppModels } from "../../../models/objects";

import { ConfigurationService } from "../../../providers/configuration";
import { LibrariesService } from "../../../providers/libraries";

import { LibraryInfoPage } from "../info/info";

@Component({
	selector: "page-search-libraries",
	templateUrl: "search.html"
})
export class SearchLibrariesPage {
	constructor(
		public navCtrl: NavController,
		public navParams: NavParams,
		public actionSheetCtrl: ActionSheetController,
		public alertCtrl: AlertController,
		public keyboard: Keyboard,
		public configSvc: ConfigurationService,
		public librariesSvc: LibrariesService
	){
	}

	// attributes
	info = {
		filterBy: {
			Query: undefined,
			And: {
				OwnerID: {
					Equals: undefined
				},
				Province: {
					Equals: undefined
				}
			}
		},
		orderBy: "Title",
		pagination: AppData.Paginations.default(),
		state: {
			searching: false,
			filtering: false,
			cancel: "Đóng",
			holder: "Search"
		},
		title: "Danh sách thư viện",
		totalRecords: 0,
		pageNumber: 0,
		isAppleOS: AppUtility.isAppleOS()
	};
	orders = [
		{
			label: "Tên (A - Z)",
			value: "Title"
		},
		{
			label: "Mới đăng ký",
			value: "Registered"
		}
	];
	libraries: Array<AppModels.Library> = undefined;
	ratings = {};

	// controls
	@ViewChild(Searchbar) searchBarCtrl: Searchbar;
	infiniteScrollCtrl: InfiniteScroll = undefined;

	// page events
	ionViewDidEnter() {
		if (this.libraries == undefined) {
			this.info.filterBy.Query = this.navParams.get("Query");
			this.info.filterBy.And.OwnerID.Equals = this.navParams.get("OwnerID");
			this.info.filterBy.And.Province.Equals = this.navParams.get("Province");

			let request = AppData.buildRequest(this.info.filterBy, undefined, this.info.pagination, r => {
				if (!AppUtility.isNotEmpty(r.FilterBy.And.OwnerID.Equals)) {
					r.FilterBy.And.OwnerID.Equals = undefined;
				}
				if (!AppUtility.isNotEmpty(r.FilterBy.And.Province.Equals)) {
					r.FilterBy.And.Province.Equals = undefined;
				}
			});
			this.info.pagination = AppData.Paginations.get(request, "L");

			if (!this.info.pagination) {
				this.doSearch();
			}
			else {
				if (this.info.pageNumber < 1) {
					this.info.pageNumber = 1;
					this.info.totalRecords = AppData.Paginations.computeTotal(this.info.pageNumber, this.info.pagination);
				}
				this.doBuild();
			}
		}
	}

	ionViewDidLoad() {
		AppEvents.on(
			"LibraryIsUpdated",
			(info: any) => {
				if (this.libraries != undefined) {
					let index = AppUtility.find(this.libraries, l => l.ID == info.args.ID);
					if (index > -1) {
						this.libraries[index] = AppData.Libraries.getValue(info.args.ID);
					}
				}
			},
			"EventHandlerToUpdateLibraryInfoOnSearchPage"
		);
		AppEvents.on(
			"LibraryIsDeleted",
			(info: any) => {
				if (this.libraries != undefined) {
					let index = AppUtility.find(this.libraries, l => l.ID == info.args.ID);
					if (index > -1) {
						this.libraries.splice(index, 1);
					}
				}
			},
			"EventHandlerToDeleteLibraryInfoOnSearchPage"
		);
		AppEvents.on(
			"LibrariesAreUpdated",
			(info: any) => {
				if (!AppUtility.isNotEmpty(this.info.filterBy.Query)) {
					this.doBuild();
				}
			},
			"EventHandlerToUpdateLibrariesOnSearchPage"
		);
	}

	ionViewWillUnload() {
		AppEvents.off("LibraryIsUpdated", "EventHandlerToUpdateLibraryInfoOnSearchPage");
		AppEvents.off("LibraryIsDeleted", "EventHandlerToDeleteLibraryInfoOnSearchPage");
		AppEvents.off("LibrariesAreUpdated", "EventHandlerToUpdateLibrariesOnSearchPage");
	}

	// search & build the listing of libraries
	doSearch(onCompleted?: () => void) {
		let request = AppData.buildRequest(this.info.filterBy, undefined, this.info.pagination, r => {
			if (!AppUtility.isNotEmpty(r.FilterBy.And.OwnerID.Equals)) {
				r.FilterBy.And.OwnerID.Equals = undefined;
			}
			if (!AppUtility.isNotEmpty(r.FilterBy.And.Province.Equals)) {
				r.FilterBy.And.Province.Equals = undefined;
			}
		});

		this.librariesSvc.search(request,
			(data?: any) => {
				this.info.pagination = this.info.state.searching && data != undefined
					? AppData.Paginations.default(data.Data)
					: AppData.Paginations.get(request, "L");

				if (!this.info.state.searching && !this.info.state.filtering) {
					this.info.pageNumber = this.info.pagination.PageNumber;
					this.info.totalRecords = AppData.Paginations.computeTotal(this.info.pageNumber, this.info.pagination);
				}

				this.doBuild(this.info.state.searching && data != undefined ? data.Data.Objects : undefined);
				onCompleted != undefined && onCompleted();
			}
		);
	}

	doBuild(searchResults?: Array<AppModels.Library>) {
		// initialize the list
		var libraries = new List(searchResults != undefined ? searchResults : AppData.Libraries.values());

		// apply filter-by
		if (this.info.state.filtering && AppUtility.isNotEmpty(this.info.filterBy.Query)) {
			let query = AppUtility.toANSI(this.info.filterBy.Query).trim().toLowerCase();
			libraries = libraries.Where((lib) => {
				return AppUtility.indexOf(lib.Title, query) > -1
			});
		}

		// transform
		if (searchResults != undefined) {
			libraries = libraries.Select((lib) => {
				return AppModels.Library.deserialize(lib);
			});
		}

		// apply order-by
		switch (this.info.orderBy) {
			case "Registered":
				libraries = libraries.OrderByDescending(lib => lib.Registered).ThenBy(lib => lib.Title);
				break;

			default:
				libraries = libraries.OrderBy(lib => lib.Title).ThenByDescending(lib => lib.Updated);
				break;
		}

		// paging
		if (!this.info.state.searching && !this.info.state.filtering && this.info.pageNumber > 0) {
			libraries = libraries.Take(this.info.pageNumber * (this.info.pagination != undefined ? this.info.pagination.PageSize : 20));
		}

		// convert the list of results to array
		this.libraries = libraries.ToArray();

		// prepare ratings
		new List(this.libraries).ForEach((lib) => {
			if (!this.ratings[lib.ID]) {
				let rating = lib.RatingPoints.getValue("General");
				this.ratings[lib.ID] = rating != undefined ? rating.Average : 0;
			}
		});
	}

	trackBy(index: number, library: AppModels.Library) {
		return library.ID;
	}

	// event handlers
	onInfiniteScroll(infiniteScroll: any) {
		// capture
		if (this.infiniteScrollCtrl == undefined) {
			this.infiniteScrollCtrl = infiniteScroll;
		}

		// searching
		if (this.info.state.searching && AppUtility.isNotEmpty(this.info.filterBy.Query)) {
			if (this.info.pagination.PageNumber < this.info.pagination.TotalPages) {
				this.doSearch(() => {
					this.infiniteScrollCtrl.complete();
				});
			}
			else {
				this.infiniteScrollCtrl.complete();
				this.infiniteScrollCtrl.enable(false);
			}
		}

		// filtering
		else if (this.info.state.filtering) {
			this.infiniteScrollCtrl.complete();
			this.infiniteScrollCtrl.enable(false);
		}

		// surfing
		else {
			if (this.info.pageNumber < this.info.pagination.PageNumber) {
				this.info.pageNumber++;
				this.info.totalRecords = AppData.Paginations.computeTotal(this.info.pageNumber, this.info.pagination);
				this.doBuild();
				this.infiniteScrollCtrl.complete();
			}
			else if (this.info.pagination.PageNumber < this.info.pagination.TotalPages) {
				this.doSearch(() => {
					this.infiniteScrollCtrl.complete();
				});
			}
			else {
				this.infiniteScrollCtrl.complete();
				this.infiniteScrollCtrl.enable(false);
			}
		}
	}

	onSearch() {
		if (this.info.state.searching) {
			this.libraries = [];
			if (AppUtility.isNotEmpty(this.info.filterBy.Query)) {
				this.doSearch();
			}
		}
		else {
			this.doBuild();
		}
	}

	onCancel() {
		this.info.state.searching = false;
		this.info.state.filtering = false;
		this.info.filterBy.Query = "";

		this.info.pagination = AppData.Paginations.get(AppData.buildRequest(this.info.filterBy, null, this.info.pagination), "L");
		this.doBuild();

		if (this.infiniteScrollCtrl != undefined) {
			this.infiniteScrollCtrl.enable(true);
		}
	}

	// helpers
	getAvatar(library: AppModels.Library) {
		return AppUtility.getAvatarImage(library);
	}

	openLibrary(library: AppModels.Library) {
		this.navCtrl.push(LibraryInfoPage, { ID: library.ID });
	}

	registerLibrary() {
		if (this.configSvc.isAuthenticated()) {
			this.navCtrl.push(LibraryInfoPage, { Register: true });
		}
		else {
			this.alertCtrl.create({
				title: "Lỗi",
				message: "Vui lòng đăng nhập tài khoản trước khi đăng ký thư viện",
				enableBackdropDismiss: true,
				buttons: [{
					text: "Đóng",
					role: "cancel"
				}]
			}).present();
		}
	}

	showSearch() {
		this.libraries = [];
		this.info.pagination = null;
		this.info.state.searching = true;
		this.info.state.holder = "Tìm kiếm (không dấu cũng OK)";
		AppUtility.focus(this.searchBarCtrl, this.keyboard);
	}

	showActions() {
		var actionSheet = this.actionSheetCtrl.create({
			enableBackdropDismiss: true,
			buttons: [
				{
					text: "Tìm kiếm",
					icon: this.info.isAppleOS ? undefined : "search",
					handler: () => {
						this.showSearch();
					}
				},
				{
					text: "Lọc/Tìm nhanh",
					icon: this.info.isAppleOS ? undefined : "funnel",
					handler: () => {
						this.info.state.filtering = true;
						this.info.state.holder = "Tìm nhanh (không dấu cũng OK)";
						AppUtility.focus(this.searchBarCtrl, this.keyboard);
					}
				},
				{
					text: "Thay đổi cách sắp xếp",
					icon: this.info.isAppleOS ? undefined : "list-box",
					handler: () => {
						this.showOrders();
					}
				}
			]
		});

		if (this.info.pagination != null && this.info.pageNumber < this.info.pagination.PageNumber) {
			actionSheet.addButton({
				text: "Hiển thị toàn bộ " + AppData.Paginations.computeTotal(this.info.pagination.PageNumber, this.info.pagination) + " kết quả",
				icon: this.info.isAppleOS ? undefined : "eye",
				handler: () => {
					this.info.pageNumber = this.info.pagination.PageNumber;
					this.info.totalRecords = AppData.Paginations.computeTotal(this.info.pageNumber, this.info.pagination);
					this.doBuild();
				}
			});
		}

		actionSheet.addButton({
			text: "Huỷ bỏ",
			icon: this.info.isAppleOS ? undefined : "close",
			role: "cancel"
		});
		
		actionSheet.present();
	}

	showOrders() {
		var alert = this.alertCtrl.create({
			title: "Sắp xếp theo",
			enableBackdropDismiss: true,
			buttons: [
				{
					text: "Huỷ",
					role: "cancel"
				},
				{
					text: "Đặt",
					handler: (orderBy: string) => {
						if (this.info.orderBy != orderBy) {
							this.info.orderBy = orderBy;
							this.doBuild();
						}
					}
				}
			]
		});

		new List<any>(this.orders).ForEach(o => alert.addInput({
			type: "radio",
			label: o.label,
			value: o.value,
			checked: this.info.orderBy == o.value
		}));

		alert.present();
	}

}