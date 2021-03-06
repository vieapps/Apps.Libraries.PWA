import { Injectable } from "@angular/core";
import { Http } from "@angular/http";
import { Platform } from "ionic-angular";
import { Storage } from "@ionic/storage";
import { Device } from "@ionic-native/device";
import { List } from "linqts";
import "rxjs/add/operator/toPromise";
import "rxjs/add/operator/map";

import { AppUtility } from "../helpers/utility";
import { AppCrypto } from "../helpers/crypto";
import { AppAPI } from "../helpers/api";
import { AppEvents } from "../helpers/events";
import { AppRTU } from "../helpers/rtu";

import { AppData } from "../models/data";
import { AppModels } from "../models/objects";

@Injectable()
export class ConfigurationService {

	constructor(
		public http: Http,
		public platform: Platform,
		public device: Device,
		public storage: Storage
	){
		AppAPI.setHttp(this.http);
	}

	/** Prepare the working environments of the app */
	prepare(onCompleted?: (data?: any) => void) {
		// app mode
		AppData.Configuration.app.mode = this.platform.is("cordova") && this.device.platform != "browser" ? "NTA" : "PWA";

		// native app
		if (AppUtility.isNativeApp()) {
			AppData.Configuration.app.platform = this.device.platform;
			AppData.Configuration.session.device = this.device.uuid + "@" + AppData.Configuration.app.name;
		}

		// progressive web app
		else {
			AppData.Configuration.app.host = window.location.hostname;
			if (AppUtility.indexOf(AppData.Configuration.app.host, ".") > 0) {
				let host = AppUtility.toArray(AppData.Configuration.app.host, ".");
				AppData.Configuration.app.host = host[host.length - 2] + "." + host[host.length - 1];
				AppData.Configuration.app.name = AppData.Configuration.app.host;
			}

			AppData.Configuration.app.platform = this.device.platform;
			if (!AppUtility.isNotEmpty(AppData.Configuration.app.platform) || AppData.Configuration.app.platform == "browser") {
				AppData.Configuration.app.platform =
					/iPhone|iPad|iPod|Windows Phone|Android|BlackBerry|BB10|IEMobile|webOS|Opera Mini/i.test(window.navigator.userAgent)
						? /iPhone|iPad|iPod/i.test(window.navigator.userAgent)
							? "iOS"
							: /Windows Phone/i.test(window.navigator.userAgent)
								? "Windows Phone"
								: /Android/i.test(window.navigator.userAgent)
									? "Android"
									: /BlackBerry|BB10/i.test(window.navigator.userAgent)
										? "BlackBerry"
										: "Mobile"
						: "Desktop";
			}

			// add mode when working with progressive web app (PWA)
			if (AppData.Configuration.app.mode == "PWA") {
				AppData.Configuration.app.platform += " " + AppData.Configuration.app.mode;
			}

			// refer
			let refer = this.platform.getQueryParam("refer");
			if (AppUtility.isNotEmpty(refer)) {
				refer = AppUtility.getQueryParamJson(refer);
				AppData.Configuration.app.refer = {
					id: AppUtility.isNotEmpty(refer.id) ? refer.id : "",
					section: AppUtility.isNotEmpty(refer.section) ? refer.section : ""
				};
			}
		}

		onCompleted != undefined && onCompleted(AppData.Configuration);
	}

	/** Initializes the configuration settings of the app */
	async initializeAsync(onNext?: (data?: any) => void, onError?: (error?: any) => void, noInitializeSession?: boolean) {
		// prepare environment
		AppData.Configuration.app.mode == "" && this.prepare();

		// load saved session
		if (AppData.Configuration.session.jwt == null || AppData.Configuration.session.keys == null) {
			await this.loadSessionAsync();
		}
		
		// initialize session
		if (AppUtility.isFalse(noInitializeSession)) {
			await this.initializeSessionAsync(onNext, onError);
		}
		else {
			onNext != undefined && onNext();
		}
	}

	/** Initializes the session with REST API */
	async initializeSessionAsync(onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let response = await AppAPI.GetAsync("users/session");
			let data = response.json();
			if (data.Status == "OK") {
				await this.updateSessionAsync(data.Data, () => {
					let isAuthenticated = this.isAuthenticated() && AppUtility.isObject(AppData.Configuration.session.account, true);
					AppData.Configuration.session.account = isAuthenticated
						? AppData.Configuration.session.account
						: this.getAccount(true);
					AppEvents.broadcast(isAuthenticated ? "SessionIsRegistered" : "SessionIsInitialized", AppData.Configuration.session);
					onNext != undefined && onNext(data);
				});
			}
			else {
				console.error("[Configuration]: Error occurred while initializing the session");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Configuration]: Error occurred while initializing the session", e);
			onError != undefined && onError(e);
		}
	}

	/** Registers the initialized session (anonymous) with REST API */
	async registerSessionAsync(onNext?: (data?: any) => void, onError?: (error?: any) => void) {
		try {
			let path = "users/session"
				+ "?register=" + AppData.Configuration.session.id
			let response = await AppAPI.GetAsync(path);
			let data = response.json();
			if (data.Status == "OK") {
				AppData.Configuration.session.account = this.getAccount(true);
				await this.saveSessionAsync(() => {
					AppEvents.broadcast("SessionIsRegistered", AppData.Configuration.session);
				});
				onNext != undefined && onNext(data);
			}
			else {
				console.error("[Configuration]: Error occurred while registering the session");
				AppUtility.isObject(data.Error, true) && console.log("[" + data.Error.Type + "]: " + data.Error.Message);
				onError != undefined && onError(data);
			}
		}
		catch (e) {
			console.error("[Configuration]: Error occurred while registering the session", e);
			onError != undefined && onError(e);
		}
	}

	/** Updates the session and stores into storage */
	async updateSessionAsync(session: any, onCompleted?: () => void) {
		if (AppUtility.isNotEmpty(session.ID)) {
			AppData.Configuration.session.id = session.ID;
		}

		if (AppUtility.isNotEmpty(session.DeviceID)) {
			AppData.Configuration.session.device = session.DeviceID;
		}

		if (AppUtility.isObject(session.Keys, true)) {
			AppData.Configuration.session.keys = {
				jwt: session.Keys.JWT,
				aes: {
					key: session.Keys.AES.Key,
					iv: session.Keys.AES.IV
				},
				rsa: {
					exponent: session.Keys.RSA.Exponent,
					modulus: session.Keys.RSA.Modulus
				}
			};
			AppCrypto.initKeys(AppData.Configuration.session.keys);
		}

		if (AppUtility.isNotEmpty(session.JWT)) {
			AppData.Configuration.session.jwt = AppCrypto.jwtDecode(session.JWT, AppUtility.isObject(AppData.Configuration.session.keys, true) ? AppData.Configuration.session.keys.jwt : AppData.Configuration.app.name);
		}

		await this.saveSessionAsync(onCompleted);
	}

	/** Loads the session from storage */
	async loadSessionAsync(onCompleted?: () => void) {
		try {
			let data = await this.storage.get("VIEApps-Session");
			if (AppUtility.isNotEmpty(data) && data != "{}") {
				AppData.Configuration.session = JSON.parse(data as string);
				if (AppData.Configuration.session.account != null && AppData.Configuration.session.account.profile != null) {
					AppData.Configuration.session.account.profile == AppModels.Account.deserialize(AppData.Configuration.session.account.profile);
				}
				AppEvents.broadcast("SessionIsLoaded", AppData.Configuration.session);
			}
		}
		catch (e) {
			console.error("[Configuration]: Error occurred while loading the saved/offline session", e);
		}

		onCompleted != undefined && onCompleted();
	}

	/** Saves the session into storage */
	async saveSessionAsync(onCompleted?: () => void) {
		try {
			await this.storage.set("VIEApps-Session", JSON.stringify(AppUtility.clone(AppData.Configuration.session, ["captcha"])));
		}
		catch (e) {
			console.error("[Configuration]: Error occurred while saving/storing the session", e);
		}

		onCompleted != undefined && onCompleted();
	}

	/** Deletes the session from storage */
	async deleteSessionAsync(onCompleted?: () => void) {
		AppData.Configuration.session.id = null;
		AppData.Configuration.session.jwt = null;
		AppData.Configuration.session.keys = null;
		AppData.Configuration.session.account = this.getAccount(true);
		await this.storage.remove("VIEApps-Session");
		onCompleted != undefined && onCompleted();
	}

	/** Gets the information of the current/default account */
	getAccount(getDefault?: boolean) {
		return AppUtility.isTrue(getDefault) || AppData.Configuration.session.account == null
			? {
					id: null,
					roles: null,
					privileges: null,
					status: null,
					profile: null,
					facebook: {
						id: null,
						name: null,
						pictureUrl: null,
						profileUrl: null
					}
				}
			: AppData.Configuration.session.account;
	}

	/** Prepares account information */
	prepareAccount(data: any) {
		let account: { Roles: Array<string>, Privileges: Array<AppModels.Privilege>, Status: string } = {
			Roles: [],
			Privileges: [],
			Status: "Registered"
		};

		if (data.Roles && AppUtility.isArray(data.Roles)) {
			account.Roles = new List<string>(data.Roles)
				.Select(r => r.trim())
				.Distinct()
				.ToArray();
		}

		if (data.Privileges && AppUtility.isArray(data.Privileges)) {
			account.Privileges = new List<any>(data.Privileges)
				.Select(p => AppModels.Privilege.deserialize(p))
				.ToArray();
		}

		if (AppUtility.isNotEmpty(data.Status)) {
			account.Status = data.Status as string;
		}

		return account;
	}

	/**
	 * Updates information of the account
	 * @param data 
	 * @param onCompleted 
	 */
	updateAccount(data: any, onCompleted?: () => void) {
		let info = this.prepareAccount(data);
		if (info.Roles) {
			AppData.Configuration.session.account.roles = info.Roles;
		}
		if (info.Privileges) {
			AppData.Configuration.session.account.privileges = info.Privileges;
		}
		if (info.Status) {
			AppData.Configuration.session.account.status = info.Status;
		}
		onCompleted != undefined && onCompleted();
	}

	/**
	 * Call the service to patch information of the account
	 * @param onNext 
	 * @param defer 
	 */
	patchAccount(onNext?: () => void, defer?: number) {
		AppUtility.setTimeout(() => {
			AppRTU.send(
				{
					ServiceName: "users",
					ObjectName: "account",
					Verb: "GET",
					Query: {
						"x-status": ""
					},
					Extra: {
						"x-status": ""
					}
				},
				() => {
					onNext != undefined && onNext();
				},
				(observable) => {
					observable.map(response => response.json()).subscribe(
						(data: any) => {
							this.updateAccount(data.Data);
							onNext != undefined && onNext();
						},
						(error: any) => {
							console.error("[Configuration]: Error occurred while patching an account", error);
						}
					);
				}
			);
		}, defer || 345);
	}

	/** Gets the state that determines the app is ready to go */
	isReady() {
		return AppUtility.isObject(AppData.Configuration.session.keys, true) && AppUtility.isObject(AppData.Configuration.session.jwt, true);
	}

	/** Gets the state that determines the current account is authenticated or not */
	isAuthenticated() {
		return AppUtility.isObject(AppData.Configuration.session.jwt, true) && AppUtility.isNotEmpty(AppData.Configuration.session.jwt.uid);
	}

}